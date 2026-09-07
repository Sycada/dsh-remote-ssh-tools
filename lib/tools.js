/**
 * dsh-remote-ssh — agent tool definitions (defineTool), registered with the
 * harness ToolRuntime so every session can drive SSH automatically.
 *
 * Security invariants enforced here:
 *  - secrets are addressed by REFERENCE only (passwordRef / passphraseRef);
 *    inline secret values are rejected;
 *  - tool results never contain resolved secrets, key material, or host keys;
 *  - optional hostKeyPolicy, run timeouts and output caps come from cfg.
 */
import { createRequire } from "node:module";
import { runCommand, resolveTarget, removeProfileWithCreds, sftpList, sftpUpload, sftpDownload } from "./engine.js";
import { pagePathFor } from "./routes.js";

const requireMod = createRequire(import.meta.url);

function secretFree(input, scope, depth = 0) {
  if (!input || typeof input !== "object" || depth > 2) return input;
  const banned = ["password", "passphrase", "privateKey", "keyContent"];
  const hit = banned.find((k) => Object.prototype.hasOwnProperty.call(input, k));
  if (hit !== undefined) {
    throw new Error(
      `${scope}: refusing inline secret field "${hit}" — store secrets via the credentials center and pass a passwordRef/passphraseRef instead`
    );
  }
  for (const value of Object.values(input)) {
    if (value && typeof value === "object" && !Array.isArray(value)) secretFree(value, scope, depth + 1);
  }
  return input;
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function toolTargetFrom(args, requiredProfileMessage) {
  if (args.profile || args.id) return { profile: args.profile || args.id };
  if (args.host) {
    return {
      host: str(args.host),
      port: args.port ? Number(args.port) : undefined,
      user: str(args.user),
      auth: {
        type: args.auth?.type ?? "password",
        ...(args.auth?.keyPath ? { keyPath: str(args.auth.keyPath) } : {}),
        ...(args.auth?.passwordRef ? { passwordRef: str(args.auth.passwordRef) } : {}),
        ...(args.auth?.passphraseRef ? { passphraseRef: str(args.auth.passphraseRef) } : {}),
      },
    };
  }
  throw new Error(requiredProfileMessage);
}

const OUT_OK = (extra = {}) => ({
  type: "object",
  additionalProperties: false,
  properties: {
    ok: { type: "boolean" },
    ...extra,
  },
});

/**
 * Render helpers — DSH output.render contract.
 *
 * defineTool() wraps `options.output.render` and invokes it on every tool result
 * WITHOUT a null check, so a tool whose `output` lacks `render` breaks ALL of its
 * calls with "output.render failed: userRender is not a function" even though the
 * underlying SSH work succeeded. Every tool below therefore declares a render
 * returning content blocks `[{ type: "text", text }]`. Renders also run on REPLAY
 * of older logged args, so they must never throw: `safe` falls back to a JSON dump.
 */
const strOf = (v) =>
  typeof v === "string" ? v : v == null ? "" : JSON.stringify(v, null, 2);

const content = (text) => [{ type: "text", text: strOf(text) }];

const safe = (fn) => (_args, value) => {
  try {
    const out = fn(_args, value);
    if (typeof out === "string") return content(out);
    if (Array.isArray(out) && out.length) return out;
    return content(JSON.stringify(value, null, 2));
  } catch {
    return content(JSON.stringify(value, null, 2));
  }
};

const targetOf = (p) =>
  p && p.host ? (p.user ? `${p.user}@${p.host}:${p.port}` : `${p.host}:${p.port}`) : "";

const PROFILE_ITEM = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    group: { type: "string" },
    host: { type: "string" },
    port: { type: "number" },
    user: { type: "string" },
    notes: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    created: { type: "string" },
    updated: { type: "string" },
    auth: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string" },
        keyPath: { type: "string" },
        passwordRef: { type: "string" },
        passphraseRef: { type: "string" },
      },
    },
  },
};

const TARGET_PROPS = {
  profile: { type: "string", description: "Saved profile name or id to connect with (preferred)." },
  host: { type: "string", description: "Host / IP when not using a saved profile, e.g. '192.168.1.20' or 'user@host'." },
  user: { type: "string", description: "SSH username (optional; only with host)." },
  port: { type: "number", description: "SSH port (optional; default 22)." },
  auth: {
    type: "object",
    additionalProperties: false,
    description: "Authentication descriptor — references only, never raw secrets.",
    properties: {
      type: { type: "string", description: "'password', 'key' or 'agent'." },
      keyPath: { type: "string", description: "Path to a private key file when type='key'." },
      passwordRef: { type: "string", description: "Credential ref / env var name holding the password." },
      passphraseRef: { type: "string", description: "Credential ref / env var name for the key passphrase." },
    },
  },
};

const AUTH_PROFILE_PROPS = {
  authType: { type: "string", description: "agent | password | key" },
  keyPath: { type: "string", description: "private key path when authType='key'" },
  passwordRef: { type: "string", description: "credential ref for the password (default derived from the profile name)" },
  passphraseRef: { type: "string", description: "credential ref for the key passphrase" },
};

/**
 * Build every tool and register it on the harness ToolRuntime once the
 * 'tools' service is available. Returns the teardown function.
 */
export function registerTools(ctx, api) {
  const { store, cfg, engine } = api;
  ctx.inject(["tools"], (sctx) => {
    sctx.effect(() => {
      const { defineTool } = requireMod("@deepseek-ai/dsh-tools");
      const disposers = [];

      const add = (tool) => {
        disposers.push(sctx.tools.register(defineTool(tool)));
      };

      add({
        name: "ssh_profile_list",
        description:
          "List saved SSH connection profiles (name/host/port/user/auth type). Use before ssh_run / ssh_session_open when the user mentions a known server — prefer the saved profile id instead of asking for host+credentials.",
        parameters: {},
        output: {
          schema: OUT_OK({
            count: { type: "number" },
            profiles: { type: "array", items: PROFILE_ITEM },
          }),
          render: safe((_args, value) => {
            if (!value.ok) return "ssh_profile_list failed";
            if (!Array.isArray(value.profiles) || value.profiles.length === 0) return "No saved SSH profiles yet.";
            return value.profiles
              .map((p) => `${p.id}: ${p.name} -> ${targetOf(p)} (${p.auth?.type ?? "agent"})${p.tags?.length ? " [" + p.tags.join(", ") + "]" : ""}`)
              .join("\n");
          }),
        },
        async execute(args) {
          const profiles = store.listProfiles();
          return { ok: true, count: profiles.length, profiles };
        },
      });

      add({
        name: "ssh_profile_add",
        description:
          "Save a new SSH connection profile for later reuse. Secrets are never accepted inline: set the password/passphrase afterwards with ssh_secret_status + the settings card, or pre-create the credential ref in Settings > credentials.",
        parameters: {
          name: { type: "string", description: "Unique profile name, e.g. 'prod-web'." },
          host: { type: "string", description: "Host name or IP." },
          port: { type: "number", description: "Port (default 22)." },
          user: { type: "string", description: "Username (optional; defaults to the local user on connect)." },
          group: { type: "string", description: "Optional group/tag label for organization." },
          notes: { type: "string", description: "Optional free-text notes." },
          ...AUTH_PROFILE_PROPS,
        },
        output: {
          schema: OUT_OK({
            profile: PROFILE_ITEM,
            hint: { type: "string" },
          }),
          render: safe((_args, value) => {
            const p = value.profile;
            const lines = [p ? `Profile saved: ${p.name} -> ${targetOf(p)} (${p.auth?.type ?? "agent"})` : "Profile saved."];
            if (value.hint) lines.push(value.hint);
            return lines.join("\n");
          }),
        },
        async execute(args) {
          secretFree(args, "ssh_profile_add");
          const profile = store.upsertProfile({
            name: str(args.name),
            host: str(args.host),
            port: args.port,
            user: str(args.user),
            group: str(args.group),
            notes: str(args.notes),
            auth: {
              type: args.authType ?? "agent",
              ...(str(args.keyPath) ? { keyPath: str(args.keyPath) } : {}),
              ...(str(args.passwordRef) ? { passwordRef: str(args.passwordRef) } : {}),
              ...(str(args.passphraseRef) ? { passphraseRef: str(args.passphraseRef) } : {}),
            },
          });
          const hint =
            profile.auth.type === "password"
              ? `stored. Set its password via the Remote SSH settings card or the credential "${profile.auth.passwordRef}" before ssh_run will authenticate.`
              : profile.auth.type === "key"
                ? `stored with key ${profile.auth.keyPath}.`
                : "stored (agent/default keys).";
          return { ok: true, profile, hint };
        },
      });

      add({
        name: "ssh_profile_update",
        description: "Update an existing SSH profile (name/host/port/user/auth). Partial fields only; omit fields to keep them.",
        parameters: {
          id: { type: "string", description: "Profile id or name to update." },
          name: { type: "string" },
          host: { type: "string" },
          port: { type: "number" },
          user: { type: "string" },
          group: { type: "string" },
          notes: { type: "string" },
          ...AUTH_PROFILE_PROPS,
        },
        output: {
          schema: OUT_OK({ profile: PROFILE_ITEM }),
          render: safe((_args, value) => {
            const p = value.profile;
            return p ? `Profile updated: ${p.name} -> ${targetOf(p)} (${p.auth?.type ?? "agent"})` : "Profile updated.";
          }),
        },
        async execute(args) {
          secretFree(args, "ssh_profile_update");
          const existing = store.findProfile(str(args.id));
          if (!existing) throw new Error(`profile "${args.id}" not found`);
          const authPatch = {};
          if (args.authType) authPatch.type = String(args.authType);
          if (args.keyPath !== undefined && args.keyPath !== null) authPatch.keyPath = str(args.keyPath);
          if (args.passwordRef !== undefined && args.passwordRef !== null) authPatch.passwordRef = str(args.passwordRef);
          if (args.passphraseRef !== undefined && args.passphraseRef !== null) authPatch.passphraseRef = str(args.passphraseRef);
          // Partial update: only fields the caller actually provided (non-empty) are
          // patched; everything else is kept from the existing profile.
          const patch = {};
          const patchText = (k) => {
            const v = args[k];
            if (v !== undefined && v !== null && str(v) !== "") patch[k] = str(v);
          };
          patchText("name");
          patchText("host");
          patchText("user");
          patchText("group");
          patchText("notes");
          if (args.port !== undefined && args.port !== null) patch.port = args.port;
          if (Object.keys(authPatch).length > 0) patch.auth = authPatch;
          if (Object.keys(patch).length === 0) throw new Error(`ssh_profile_update: nothing to update for profile "${args.id}"`);
          const profile = store.upsertProfile(patch, existing.id);
          return { ok: true, profile };
        },
      });

      add({
        name: "ssh_profile_remove",
        description:
          "Delete a saved SSH profile. Set clearCredentials=true to ALSO delete its password/passphrase values from the DSH credentials center (.credentials.yaml); refs shared with other profiles are skipped automatically. Default leaves stored credentials untouched.",
        parameters: {
          id: { type: "string", description: "Profile id or name." },
          clearCredentials: { type: "boolean", description: "Also clear this profile's credential refs in the credentials center (default false)." },
        },
        output: {
          schema: OUT_OK({
            removed: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, name: { type: "string" }, host: { type: "string" } } },
            clearRequested: { type: "boolean" },
            cleared: { type: "array", items: { type: "string" } },
            skipped: { type: "array", items: { type: "object", additionalProperties: false, properties: { ref: { type: "string" }, reason: { type: "string" } } } },
          }),
          render: safe((_args, value) => {
            const lines = [value.removed ? `Removed profile ${value.removed.name} (${value.removed.host}).` : "Profile removed."];
            if (value.clearRequested) {
              if (Array.isArray(value.cleared) && value.cleared.length) lines.push(`Cleared credentials: ${value.cleared.join(", ")}.`);
              if (Array.isArray(value.skipped) && value.skipped.length) lines.push(`Skipped shared credentials: ${value.skipped.map((s) => s.ref).join(", ")}.`);
            }
            return lines.join("\n");
          }),
        },
        async execute(args) {
          const report = await removeProfileWithCreds(ctx, store, str(args.id), args.clearCredentials === true);
          return { ok: true, removed: report.removed, clearRequested: report.clearRequested, cleared: report.cleared, skipped: report.skipped };
        },
      });

      add({
        name: "ssh_profile_test",
        description:
          "Test SSH connectivity to a saved profile or a host: authenticates and runs a trivial echo. Useful before long tasks to surface missing credentials / wrong host quickly.",
        parameters: { ...TARGET_PROPS, timeoutMs: { type: "number", description: "Optional test timeout in ms." } },
        output: {
          schema: OUT_OK({
            host: { type: "string" },
            stdout: { type: "string" },
            stderr: { type: "string" },
            exitCode: { oneOf: [{ type: "number" }, { type: "null" }] },
            durationMs: { type: "number" },
          }),
          render: safe((_args, value) => {
            const head = value.ok ? "CONNECT OK" : "CONNECTION FAILED";
            const lines = [`${head} — ${value.host ?? "?"} (${value.durationMs ?? "?"}ms)`];
            if (value.exitCode !== null && value.exitCode !== undefined) lines.push(`exit code: ${value.exitCode}`);
            if (value.stdout) lines.push(value.stdout);
            if (value.stderr) lines.push(value.stderr);
            return lines.join("\n");
          }),
        },
        async execute(args) {
          const out = await runCommand(ctx, store, cfg, {
            target: toolTargetFrom(args, "ssh_profile_test needs a profile id or a host"),
            command: "echo CONNECT_OK && whoami && hostname",
            timeoutMs: args.timeoutMs,
          });
          return {
            ok: out.ok,
            host: out.host,
            stdout: out.stdout.trim(),
            stderr: out.stderr.trim(),
            exitCode: out.exitCode,
            durationMs: out.durationMs,
          };
        },
      });

      add({
        name: "ssh_secret_status",
        description:
          "Report which credential references a profile uses and whether values are currently set (never reveals values). Guides password/key setup before ssh_run.",
        parameters: { profile: { type: "string", description: "Profile id or name." } },
        output: {
          schema: OUT_OK({
            passwordRef: { type: "string" },
            hasPassword: { type: "boolean" },
            passphraseRef: { type: "string" },
            hasPassphrase: { type: "boolean" },
            authType: { type: "string" },
            keyPath: { type: "string" },
          }),
          render: safe((_args, value) => {
            const lines = [`auth: ${value.authType ?? "?"}`];
            if (value.keyPath) lines.push(`key: ${value.keyPath}`);
            lines.push(`password (${value.passwordRef || "no ref"}): ${value.hasPassword ? "set" : "NOT SET"}`);
            if (value.passphraseRef) lines.push(`passphrase (${value.passphraseRef}): ${value.hasPassphrase ? "set" : "NOT SET"}`);
            return lines.join("\n");
          }),
        },
        async execute(args) {
          const found = store.findProfile(str(args.profile));
          if (!found) throw new Error(`profile "${args.profile}" not found`);
          const { resolveRef } = await import("./engine.js");
          const hasPassword = found.auth.type === "password" ? (await resolveRef(ctx, found.auth.passwordRef)).length > 0 : false;
          const hasPassphrase = found.auth.passphraseRef ? (await resolveRef(ctx, found.auth.passphraseRef)).length > 0 : false;
          return {
            ok: true,
            passwordRef: found.auth.passwordRef ?? "",
            hasPassword,
            passphraseRef: found.auth.passphraseRef ?? "",
            hasPassphrase,
            authType: found.auth.type,
            keyPath: found.auth.keyPath ?? "",
          };
        },
      });

      add({
        name: "ssh_run",
        description:
          "Run a command on a remote server over SSH and return its output. Use when the user asks to execute commands on a server / remote host / production box etc. Prefer a saved profile id; otherwise pass host (+ optional user/auth refs). Never ask the user to paste passwords into chat — reference credentials instead.",
        parameters: {
          ...TARGET_PROPS,
          command: { type: "string", description: "The command to run on the remote host (bash/sh)." },
          timeoutMs: { type: "number", description: "Optional timeout in ms (default from plugin settings, 120s)." },
        },
        output: {
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ok: { type: "boolean" },
              exitCode: { oneOf: [{ type: "number" }, { type: "null" }] },
              stdout: { type: "string" },
              stderr: { type: "string" },
              truncatedStdout: { type: "boolean" },
              truncatedStderr: { type: "boolean" },
              durationMs: { type: "number" },
              host: { type: "string" },
              profileId: { oneOf: [{ type: "string" }, { type: "null" }] },
            },
          },
          render: safe((_args, value) => {
            const head = value.ok ? "ok" : "failed";
            const lines = [`ssh_run ${head} — ${value.host ?? "?"} (exit ${value.exitCode ?? "?"}, ${value.durationMs ?? "?"}ms)`];
            if (value.stdout) lines.push(value.stdout);
            if (value.stderr) lines.push(value.stderr);
            if (value.truncatedStdout) lines.push("[stdout truncated by runOutputLimit]");
            if (value.truncatedStderr) lines.push("[stderr truncated by runOutputLimit]");
            if (!value.stdout && !value.stderr) lines.push("(no output)");
            return lines.join("\n");
          }),
        },
        async execute(args) {
          secretFree(args, "ssh_run");
          const command = str(args.command);
          if (!command) throw new Error("ssh_run: command is required");
          const out = await runCommand(ctx, store, cfg, {
            target: toolTargetFrom(args, "ssh_run needs a profile id or a host"),
            command,
            timeoutMs: args.timeoutMs,
          });
          return {
            ok: out.ok,
            exitCode: out.exitCode,
            stdout: out.stdout,
            stderr: out.stderr,
            truncatedStdout: out.truncatedStdout,
            truncatedStderr: out.truncatedStderr,
            durationMs: out.durationMs,
            host: out.host,
            profileId: out.profileId ?? null,
          };
        },
      });

      add({
        name: "ssh_session_open",
        description:
          "Open an interactive SSH session for a profile (or host) and return a terminal page URL. Tell the user to open it, or call sidebar_open with page.url yourself to attach the live terminal to the side card. Sessions survive page refreshes and stay alive until closed (ssh_session_close) or the plugin unloads.",
        parameters: {
          ...TARGET_PROPS,
          waitForExit: { type: "boolean", description: "Unused in this version (kept for future scripting)." },
        },
        output: {
          schema: OUT_OK({
            session: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                host: { type: "string" },
                port: { type: "number" },
                user: { type: "string" },
                startedAt: { type: "string" },
                status: { type: "string" },
              },
            },
            page: { type: "object", additionalProperties: false, properties: { path: { type: "string" }, url: { type: "string" } } },
          }),
          render: safe((_args, value) => {
            const s = value.session;
            const lines = [];
            if (s) lines.push(`Session ${s.id} open: ${s.name} (${s.host}:${s.port}, ${s.status})`);
            else lines.push("Session open.");
            if (value.page?.url) lines.push(`Terminal: ${value.page.url}`);
            return lines.join("\n");
          }),
        },
        async execute(args, exec) {
          if (exec?.signal?.aborted) throw new Error("aborted");
          const resolved = await resolveTarget(ctx, store, cfg, toolTargetFrom(args, "ssh_session_open needs a profile id or a host"));
          const profile = resolved.profile ?? {
            id: null,
            name: `${resolved.user ? resolved.user + "@" : ""}${resolved.host}`,
            host: resolved.host,
            port: resolved.port,
            user: resolved.user,
            auth: resolved.auth,
          };
          const record = await engine.create(profile);
          const path = pagePathFor(record);
          // webServer is a cordis service: reach it via ctx.get() (direct property
          // access throws "cannot get property \"webServer\" without inject").
          let port = 43120;
          try {
            const ws = typeof ctx?.get === "function" ? ctx.get("webServer") : undefined;
            port = ws?.listenedPort ?? 43120;
          } catch { /* keep default */ }
          const url = `http://127.0.0.1:${port}${path}`;
          return {
            ok: true,
            session: {
              id: record.id,
              name: record.name,
              host: record.host,
              port: record.port,
              user: record.user,
              startedAt: record.startedAt,
              status: record.closed ? "exited" : "running",
            },
            page: { path, url },
          };
        },
      });

      add({
        name: "ssh_session_list",
        description: "List live (and recently exited) interactive SSH sessions with ids and targets. Use ssh_session_close to end one.",
        parameters: {},
        output: {
          schema: OUT_OK({
            sessions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  profileId: { oneOf: [{ type: "string" }, { type: "null" }] },
                  name: { type: "string" },
                  host: { type: "string" },
                  port: { type: "number" },
                  user: { type: "string" },
                  startedAt: { type: "string" },
                  status: { type: "string" },
                  exitCode: { oneOf: [{ type: "number" }, { type: "null" }] },
                },
              },
            },
          }),
          render: safe((_args, value) => {
            const sessions = Array.isArray(value.sessions) ? value.sessions : [];
            if (!sessions.length) return "No interactive SSH sessions.";
            return sessions
              .map((s) => `${s.id}  ${s.status}  ${targetOf(s)}  started ${s.startedAt ?? ""}${s.exitCode != null ? `  exit ${s.exitCode}` : ""}`)
              .join("\n");
          }),
        },
        async execute() {
          return { ok: true, sessions: engine.list() };
        },
      });

      add({
        name: "ssh_session_close",
        description: "Close (kill) an interactive SSH session by its session id from ssh_session_open / ssh_session_list.",
        parameters: { sessionId: { type: "string", description: "The interactive session id." } },
        output: {
          schema: OUT_OK({ closed: { type: "boolean" }, sessionId: { type: "string" } }),
          render: safe((_args, value) => `session ${value.sessionId ?? "?"}: ${value.closed ? "closed" : "not found or already closed"}`),
        },
        async execute(args) {
          const closed = engine.close(str(args.sessionId));
          return { ok: closed, closed, sessionId: str(args.sessionId) };
        },
      });

      add({
        name: "ssh_sftp_list",
        description: "List a remote directory over SFTP (same profile/host target rules as ssh_run). Useful to locate files before upload/download.",
        parameters: { ...TARGET_PROPS, path: { type: "string", description: "Remote directory to list (default '.')." } },
        output: {
          schema: OUT_OK({
            path: { type: "string" },
            entries: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, type: { type: "string" }, size: { type: "number" }, mtime: { oneOf: [{ type: "string" }, { type: "null" }] } } } },
            durationMs: { type: "number" }, host: { type: "string" }, profileId: { oneOf: [{ type: "string" }, { type: "null" }] },
          }),
          render: safe((_args, value) => {
            const entries = Array.isArray(value.entries) ? value.entries : [];
            const lines = [`${value.host ?? "?"} ${value.path ?? "."} — ${entries.length} entries (${value.durationMs ?? "?"}ms)`];
            for (const e of entries) {
              const kind = e.type === "dir" ? "dir " : e.type === "file" ? "file" : "?   ";
              lines.push(`  [${kind}] ${e.name}${e.type === "file" && e.size != null ? ` (${e.size} B)` : ""}${e.mtime ? `  ${e.mtime}` : ""}`);
            }
            return lines.join("\n");
          }),
        },
        async execute(args) {
          secretFree(args, "ssh_sftp_list");
          return sftpList(ctx, store, cfg, { target: toolTargetFrom(args, "ssh_sftp_list needs a profile id or a host"), path: args.path });
        },
      });

      add({
        name: "ssh_sftp_upload",
        description: "Upload a LOCAL file to the remote host over SFTP. Pass ensureDir=true to create missing remote directories.",
        parameters: {
          ...TARGET_PROPS,
          localPath: { type: "string", description: "Absolute path of the local file to upload." },
          remotePath: { type: "string", description: "Destination path on the remote host." },
          ensureDir: { type: "boolean", description: "Create missing remote directories (default false)." },
        },
        output: {
          schema: OUT_OK({
            localPath: { type: "string" }, remotePath: { type: "string" }, bytes: { type: "number" },
            durationMs: { type: "number" }, host: { type: "string" }, profileId: { oneOf: [{ type: "string" }, { type: "null" }] },
          }),
          render: safe((_args, value) =>
            `uploaded ${value.localPath ?? "?"} -> ${value.host ?? "?"}:${value.remotePath ?? "?"} (${value.bytes ?? 0} bytes, ${value.durationMs ?? "?"}ms)`
          ),
        },
        async execute(args) {
          secretFree(args, "ssh_sftp_upload");
          return sftpUpload(ctx, store, cfg, { target: toolTargetFrom(args, "ssh_sftp_upload needs a profile id or a host"), localPath: args.localPath, remotePath: args.remotePath, ensureDir: args.ensureDir === true });
        },
      });

      add({
        name: "ssh_sftp_download",
        description: "Download a remote file to the LOCAL machine over SFTP. Default refuses to overwrite an existing local file; pass overwrite=true to replace it.",
        parameters: {
          ...TARGET_PROPS,
          remotePath: { type: "string", description: "Path of the file on the remote host." },
          localPath: { type: "string", description: "Destination absolute path on this machine." },
          overwrite: { type: "boolean", description: "Overwrite an existing local file (default false)." },
        },
        output: {
          schema: OUT_OK({
            remotePath: { type: "string" }, localPath: { type: "string" }, bytes: { type: "number" },
            durationMs: { type: "number" }, host: { type: "string" }, profileId: { oneOf: [{ type: "string" }, { type: "null" }] },
          }),
          render: safe((_args, value) =>
            `downloaded ${value.host ?? "?"}:${value.remotePath ?? "?"} -> ${value.localPath ?? "?"} (${value.bytes ?? 0} bytes, ${value.durationMs ?? "?"}ms)`
          ),
        },
        async execute(args) {
          secretFree(args, "ssh_sftp_download");
          return sftpDownload(ctx, store, cfg, { target: toolTargetFrom(args, "ssh_sftp_download needs a profile id or a host"), remotePath: args.remotePath, localPath: args.localPath, overwrite: args.overwrite === true });
        },
      });

      return () => {
        for (const d of disposers) { try { d(); } catch { /* ignore */ } }
      };
    }, "dsh-remote-ssh: tools");
  });
}
