/**
 * dsh-remote-ssh-tools — DeepSeek Harness plugin (host half).
 *
 * Provides:
 *  - saved SSH connection profiles (~/.dsh/dsh-remote-ssh-tools/store.json),
 *    secrets only via the DSH credentials center (refs, never values);
 *  - agent tools ssh_profile_* / ssh_run / ssh_session_* / ssh_secret_status;
 *  - non-interactive execution over ssh2 and interactive terminals over
 *    node-pty + system OpenSSH bridged to a browser xterm via WebSocket;
 *  - a Settings card (client.js) for profile management;
 *  - a system-prompt section announcing the capability to every session.
 */
import { existsSync } from "node:fs";
import { resolveSshBinary, resolveRef, createSessionManager } from "./engine.js";
import { createStore, publicProfile } from "./store.js";
import { registerRoutes } from "./routes.js";
import { registerTools } from "./tools.js";

export const name = "dsh-remote-ssh-tools";
export const inject = [];

const DEFAULTS = {
  sshPath: "",
  connectTimeoutMs: 15000,
  keepaliveMs: 30000,
  runTimeoutMs: 120000,
  runOutputLimit: 1048576,
  maxSessions: 8,
  terminalScrollback: 5000,
  hostKeyPolicy: "accept-new", // "accept-new" | "strict"
  trustedHosts: [],
  defaultUser: "",
  promptSectionOrder: 560,
};

export function resolveConfig(config = {}) {
  const c = { ...DEFAULTS };
  for (const [k, v] of Object.entries(config ?? {})) {
    if (v === undefined || v === null) continue;
    if (k === "trustedHosts" && Array.isArray(v)) c.trustedHosts = v.map(String);
    else if (k === "hostKeyPolicy" && (v === "accept-new" || v === "strict")) c.hostKeyPolicy = v;
    else if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") c[k] = v;
  }
  return c;
}

async function getState(ctx, store, engine, cfg) {
  const ssh = resolveSshBinary(cfg);
  const profiles = [];
  for (const p of store.listProfiles()) {
    const pub = publicProfile(p);
    let passwordSet = false;
    let passphraseSet = false;
    let keyExists = false;
    try {
      if (p.auth.type === "password" && p.auth.passwordRef) {
        passwordSet = (await resolveRef(ctx, p.auth.passwordRef)).length > 0;
      }
      if (p.auth.passphraseRef) {
        passphraseSet = (await resolveRef(ctx, p.auth.passphraseRef)).length > 0;
      }
      if (p.auth.keyPath) keyExists = existsSync(p.auth.keyPath);
    } catch { /* keep false */ }
    profiles.push({ ...pub, secrets: { passwordSet, passphraseSet, keyExists } });
  }
  return {
    version: "0.1.2",
    profiles,
    sessions: engine.list(),
    sshBinary: ssh.file,
    settings: {
      hostKeyPolicy: cfg.hostKeyPolicy,
      runTimeoutMs: cfg.runTimeoutMs,
      runOutputLimit: cfg.runOutputLimit,
      maxSessions: cfg.maxSessions,
      terminalScrollback: cfg.terminalScrollback,
      connectTimeoutMs: cfg.connectTimeoutMs,
      defaultUser: cfg.defaultUser,
    },
  };
}

/** Cordis plugin entry. */
export function apply(ctx, config = {}) {
  const cfg = resolveConfig(config);
  const store = createStore(cfg);
  const engine = createSessionManager(ctx, store, cfg);

  const promptText = () => {
    const profiles = store.listProfiles();
    const list =
      profiles.length === 0
        ? "none saved yet (run ssh_profile_add, or tell the user to add one in Settings > Remote SSH)"
        : profiles.map((p) => `${p.name} -> ${p.user ? p.user + "@" : ""}${p.host}:${p.port} (${p.auth.type})`).join("\n");
    return [
      "## Remote SSH (dsh-remote-ssh-tools)",
      "",
      "You have first-class SSH tools: ssh_profile_list, ssh_profile_add, ssh_profile_update, ssh_profile_remove, ssh_profile_test, ssh_secret_status, ssh_run, ssh_session_open, ssh_session_list, ssh_session_close.",
      "",
      "Use them whenever the user asks to connect to, inspect, or run commands on a server / remote host / production machine. Saved profiles:",
      list,
      "",
      "- Prefer a saved profile id; otherwise pass host directly (user/port optional; default port 22).",
      "- Never ask the user to paste passwords or keys into chat. Secrets are referenced (passwordRef) and live in the DSH credentials center; if a profile lacks one, point the user to Settings > Remote SSH to set it.",
      "- ssh_run runs one command and returns its output.",
      "- For interactive work (shells, editors, tmux, long-running programs) use ssh_session_open, then open the returned page.url with sidebar_open so the live terminal appears in the side card.",
      "- ssh_session_list / ssh_session_close manage interactive sessions; they survive page refresh until closed.",
      "",
    ].join("\n");
  };

  // --- system prompt section, refreshed when profiles change ---
  let refreshPromptRef = () => {};
  let refreshPrompt = () => { try { refreshPromptRef(); } catch { /* ignore */ } };
  ctx.inject(["systemPrompt"], (sctx) => {
    sctx.effect(() => {
      let sectionDispose = null;
      const register = () => {
        if (sectionDispose) return;
        try {
          sectionDispose = sctx.systemPrompt.section({
            name: "dsh-remote-ssh-tools:capabilities",
            order: cfg.promptSectionOrder,
            text: promptText(),
          });
        } catch (error) {
          ctx.logger?.warn?.(`dsh-remote-ssh-tools: prompt section failed: ${error?.message ?? error}`);
        }
      };
      refreshPromptRef = () => {
        if (sectionDispose) { try { sectionDispose(); } catch { /* ignore */ } sectionDispose = null; }
        register();
      };
      register();
      return () => {
        if (sectionDispose) { try { sectionDispose(); } catch { /* ignore */ } sectionDispose = null; }
        refreshPromptRef = () => {};
      };
    }, "dsh-remote-ssh-tools: capabilities prompt section");
  });
  store.on(() => { try { refreshPrompt(); } catch { /* ignore */ } });

  // --- REST + WebSocket + terminal page + assets ---
  ctx.inject(["webServer"], (sctx) => {
    sctx.effect(() => {
      const { teardown } = registerRoutes(sctx, {
        store,
        engine,
        cfg,
        getState: () => getState(sctx, store, engine, cfg),
      });
      return teardown;
    }, "dsh-remote-ssh-tools: http/ws routes");
  });

  // --- agent tools ---
  registerTools(ctx, { store, cfg, engine });

  // --- teardown: kill every live pty when the plugin unloads ---
  ctx.effect(() => () => {
    try { engine.disposeAll(); } catch { /* ignore */ }
  }, "dsh-remote-ssh-tools: session teardown");

  return { store, engine, cfg };
}

export default { name, inject, apply, resolveConfig };
