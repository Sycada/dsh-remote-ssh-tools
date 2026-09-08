/**
 * dsh-remote-ssh-tools — SSH engine.
 *
 * Two channels share the same profile model:
 *  - programmatic: ssh2 Client.exec (used by ssh_run and connectivity tests),
 *    supports password/key auth via the DSH credentials center;
 *  - interactive: ssh2 SHELL channel (pure JS terminal emulation) bridged to
 *    a browser xterm over WebSocket by lib/routes.js.
 *
 * Third-party modules (ssh2) are loaded lazily via createRequire.
 */
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import * as fsn from "node:fs";
import { dirname as pathDirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

const requireMod = createRequire(import.meta.url);

export const DEFAULT_USER = "root";
export const BACKLOG_LIMIT_BYTES = 1024 * 1024; // replayed terminal backlog cap

/** Resolve a credential ref through the DSH credentials center, then env. */
export async function resolveRef(ctx, ref) {
  if (!ref) return "";
  const credentials = ctx && typeof ctx.get === "function" ? ctx.get("credentials") : undefined;
  if (credentials && typeof credentials.resolve === "function") {
    try {
      const resolved = await credentials.resolve(ref);
      if (resolved && typeof resolved.value === "string" && resolved.value !== "") return resolved.value;
    } catch {
      // fall through to environment
    }
  }
  const fromEnv = process.env[ref];
  return typeof fromEnv === "string" ? fromEnv : "";
}

function credentialsServiceOf(ctx) {
  return ctx && typeof ctx.get === "function" ? ctx.get("credentials") : undefined;
}

/** Set a credential ref through the DSH credentials center. */
export async function unsetRef(ctx, ref) {
  if (!REF_NAME_RE.test(String(ref))) {
    throw new Error(
      `credential reference "${ref}" is invalid — use only letters, digits and underscores, starting with a letter or underscore`
    );
  }
  const credentials = credentialsServiceOf(ctx);
  if (!credentials) {
    throw new Error("DSH credentials service is unavailable; remove the line from ~/.dsh/.credentials.yaml manually");
  }
  if (typeof credentials.unset === "function") {
    await credentials.unset(ref);
    return { cleared: true, ref };
  }
  throw new Error("DSH credentials service has no unset() in this build");
}

export async function setRef(ctx, ref, value) {
  if (!REF_NAME_RE.test(String(ref))) {
    throw new Error(
      `credential reference "${ref}" is invalid — use only letters, digits and underscores, starting with a letter or underscore`
    );
  }
  const credentials = credentialsServiceOf(ctx);
  if (!credentials || typeof credentials.set !== "function") {
    throw new Error("DSH credentials service is unavailable; set the environment variable directly");
  }
  if (typeof value === "string" && value.length > 0) await credentials.set(ref, value);
  else if (typeof credentials.unset === "function") await credentials.unset(ref);
}

const REF_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Locate an SSH client binary: configured path > Windows OpenSSH > PATH. */
export function resolveSshBinary(cfg = {}) {
  const candidates = [];
  if (typeof cfg.sshPath === "string" && cfg.sshPath.trim() !== "") candidates.push(cfg.sshPath.trim());
  if (process.platform === "win32") {
    const sysRoot = process.env.SystemRoot || "C:\\Windows";
    candidates.push(join(sysRoot, "System32", "OpenSSH", "ssh.exe"));
  }
  candidates.push("ssh");
  for (const file of candidates) {
    if (file !== "ssh" && file !== candidates[candidates.length - 1]) {
      try { if (existsSync(file)) return { file, from: "configured" }; } catch { /* keep looking */ }
    }
  }
  return { file: candidates[candidates.length - 1], from: "path" };
}

function defaultKeyCandidates() {
  const home = homedir();
  return [
    join(home, ".ssh", "id_ed25519"),
    join(home, ".ssh", "id_ecdsa"),
    join(home, ".ssh", "id_rsa"),
  ].filter((p) => { try { return existsSync(p); } catch { return false; } });
}

/** Build ssh2 connect options from a profile + resolved secrets. */
export async function buildConnectOptions(ctx, cfg, target, auth) {
  const port = Number(target.port) || 22;
  const username = String(target.user || cfg.defaultUser || process.env.USER || process.env.USERNAME || DEFAULT_USER).trim();
  const host = String(target.host).trim();
  if (!host) throw new Error("host is required");
  const type = auth?.type ?? "agent";
  const base = {
    host,
    port,
    username,
    hostHash: "sha256",
    readyTimeout: Number(cfg.connectTimeoutMs) || 15000,
    keepaliveInterval: Number(cfg.keepaliveMs) || 30000,
  };
  const hostKeyPolicy = cfg.hostKeyPolicy === "strict" ? "strict" : "accept-new";
  if (type === "password") {
    const passwordRef = auth?.passwordRef || `DSH_REMOTE_SSH_TOOLS_${target.name || host}_PASSWORD`;
    const password = await resolveRef(ctx, passwordRef);
    if (!password) {
      const err = new Error(`no password available for ${username}@${host}; set credential "${passwordRef}" (Settings > credentials) or the environment variable`);
      err.code = "NO_PASSWORD";
      throw err;
    }
    base.password = password;
  } else if (type === "key") {
    const keyPath = auth?.keyPath;
    if (!keyPath) throw new Error("auth.type=key requires a keyPath");
    let privateKey;
    try { privateKey = readFileSync(keyPath); } catch {
      throw new Error(`cannot read private key file "${keyPath}"`);
    }
    base.privateKey = privateKey;
    const passphraseRef = auth?.passphraseRef;
    if (passphraseRef) {
      const passphrase = await resolveRef(ctx, passphraseRef);
      if (passphrase) base.passphrase = passphrase;
    }
  } else {
    // agent/default: try the user's default key files with an empty passphrase
    const candidates = defaultKeyCandidates();
    if (candidates.length > 0) {
      base.privateKey = readFileSync(candidates[0]);
    }
  }
  return { base, username, host, hostKeyPolicy };
}

/** Resolve a profile or inline target into { profile?, host, port, user, auth }. */
export async function resolveTarget(ctx, store, cfg, spec) {
  if (spec && typeof spec === "object" && (spec.profile || spec.id)) {
    const found = store.findProfile(spec.profile || spec.id);
    if (!found) throw new Error(`profile "${spec.profile || spec.id}" not found`);
    return { profile: found, host: found.host, port: found.port, user: found.user, auth: found.auth };
  }
  const host = String(spec?.host ?? "").trim();
  if (!host) throw new Error("a profile id or a host is required");
  return {
    profile: null,
    host,
    port: Number(spec?.port) || 22,
    user: String(spec?.user ?? "").trim(),
    auth: {
      type: spec?.auth?.type ?? "password",
      ...(spec?.auth?.keyPath ? { keyPath: spec.auth.keyPath } : {}),
      passwordRef: spec?.auth?.passwordRef || `DSH_REMOTE_SSH_TOOLS_${host.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_PASSWORD`,
      ...(spec?.auth?.passphraseRef ? { passphraseRef: spec.auth.passphraseRef } : {}),
    },
  };
}

function displayHost(t) {
  return t.user ? `${t.user}@${t.host}:${t.port}` : `${t.host}:${t.port}`;
}

function hostVerifierOf(store, host, port, policy) {
  // ssh2 >= 1.16 contract: when hostHash is configured ssh2 hashes the host
  // key itself and hands us a HEX STRING, plus the REAL verify(boolean)
  // callback. Passing anything truthy accepts — an Error object would ACCEPT,
  // so we must call verify(false) to reject.
  return (key, verify) => {
    const fp = typeof key === "string" ? key : Buffer.isBuffer(key) ? key.toString("hex") : String(key);
    const known = store.getHostKey(host, port);
    if (known === undefined) {
      if (policy === "strict") { verify(false); return; }
      store.setHostKey(host, port, fp);
      verify(true);
      return;
    }
    verify(known === fp);
  };
}

/**
 * Run one command non-interactively over ssh2. Returns structured results;
 * never includes secrets.
 */
export async function runCommand(ctx, store, cfg, { target, command, timeoutMs }) {
  const started = Date.now();
  const startedAt = new Date().toISOString();
  const resolved = await resolveTarget(ctx, store, cfg, target);
  const { base, host } = await buildConnectOptions(ctx, cfg, resolved, resolved.auth);
  const limit = Number(cfg.runOutputLimit) || 1024 * 1024;
  const timeout = Math.max(1, Number(timeoutMs ?? cfg.runTimeoutMs ?? 120000));
  const { Client } = requireMod("ssh2");
  const client = new Client();
  base.hostVerifier = hostVerifierOf(store, host, resolved.port, baseHostKeyPolicy(cfg));
  let clientReady = false;
  try {
    await new Promise((resolvePromise, rejectPromise) => {
      client.once("ready", () => { clientReady = true; resolvePromise(); });
      client.once("error", (err) => rejectPromise(err));
      client.connect(base);
    });
    const execResult = await new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        rejectPromise(Object.assign(new Error(`command timed out after ${Math.round(timeout / 1000)}s`), { code: "TIMEOUT" }));
      }, timeout);
      const settle = (fn) => (value) => { clearTimeout(timer); fn(value); };
      client.exec(String(command), (err, stream) => {
        if (err) { settle(rejectPromise)(err); return; }
        let stdout = "";
        let stderr = "";
        let truncatedStdout = false;
        let truncatedStderr = false;
        let exitCode = null;
        let signal = null;
        stream.on("data", (chunk) => {
          if (stdout.length < limit) {
            const room = limit - stdout.length;
            stdout += chunk.length > room ? chunk.slice(0, room) : chunk;
            if (chunk.length > room) truncatedStdout = true;
          } else truncatedStdout = true;
        });
        stream.stderr.on("data", (chunk) => {
          if (stderr.length < limit) {
            const room = limit - stderr.length;
            stderr += chunk.length > room ? chunk.slice(0, room) : chunk;
            if (chunk.length > room) truncatedStderr = true;
          } else truncatedStderr = true;
        });
        stream.on("exit", (code, sig) => { exitCode = code; signal = sig; });
        stream.on("close", () => {
          settle(resolvePromise)({ stdout, stderr, exitCode, signal, truncatedStdout, truncatedStderr });
        });
      });
    });
    return {
      ok: execResult.exitCode === 0,
      exitCode: execResult.exitCode,
      signal: execResult.signal,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      truncatedStdout: execResult.truncatedStdout,
      truncatedStderr: execResult.truncatedStderr,
      durationMs: Date.now() - started,
      startedAt,
      host: displayHost(resolved),
      profileId: resolved.profile?.id ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: friendlyError(error),
      truncatedStdout: false,
      truncatedStderr: false,
      durationMs: Date.now() - started,
      startedAt,
      host: displayHost(resolved),
      profileId: resolved.profile?.id ?? null,
    };
  } finally {
    try {
      if (clientReady) client.end();
      else if (typeof client.destroy === "function") client.destroy();
      else { try { client.end(); } catch { /* not connected yet */ } }
    } catch { /* ignore */ }
  }
}

function baseHostKeyPolicy(cfg) {
  return cfg.hostKeyPolicy === "strict" ? "strict" : "accept-new";
}

function friendlyError(error) {
  const msg = error && error.message ? error.message : String(error);
  const code = error && error.code;
  if (code === "TIMEOUT") return msg;
  const lower = msg.toLowerCase();
  if (lower.includes("all configured authentication methods failed") || lower.includes("permission denied")) {
    return "SSH authentication failed (wrong password/key or the remote user is not authorized)";
  }
  if (lower.includes("host denied") || lower.includes("host key") || lower.includes("hostkey")) {
    return "host key verification failed — possible MITM or server reinstall (check/cached key in Settings > Remote SSH)";
  }
  if (lower.includes("econnrefused")) return "connection refused — is the remote sshd running and reachable?";
  if (lower.includes("etimedout") || lower.includes("timed out")) return "connection timed out (network, firewall, or wrong address)";
  if (lower.includes("ehostunreach") || lower.includes("no route")) return "no route to host";
  if (lower.includes("enoent")) return "remote command or local resource not found";
  return msg;
}

/**
 * Interactive session manager (ssh2 shell channel). Sessions survive
 * browser detach (backlog replay on reattach) until closed or engine teardown.
 */
export function createSessionManager(ctx, store, cfg) {
  const sessions = new Map();

  function sendFrame(ws, frame) {
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(frame)); } catch { /* ignore */ }
  }

  function pushBacklog(rec, text) {
    if (rec.backlogBytes >= BACKLOG_LIMIT_BYTES) {
      while (rec.backlog.length > 0 && rec.backlogBytes + text.length >= BACKLOG_LIMIT_BYTES) {
        rec.backlogBytes -= rec.backlog.shift().length;
      }
    }
    rec.backlog.push(text);
    rec.backlogBytes += text.length;
  }

  function onData(rec, chunk) {
    const text = chunk.toString("utf8");
    if (rec.ws && rec.ws.readyState === 1) sendFrame(rec.ws, { type: "out", data: Buffer.from(text, "utf8").toString("base64") });
    else pushBacklog(rec, text);
  }

  function finish(rec, exitCode, signal) {
    if (rec.closed) return;
    rec.closed = true;
    rec.exit = { exitCode, signal: signal ?? null };
    sendFrame(rec.ws, { type: "exit", exitCode, signal: signal ?? null });
    if (rec.ws) { try { rec.ws.close(1000); } catch { /* ignore */ } }
    rec.ws = null;
  }

  async function create(profile) {
    if (sessions.size >= Math.max(1, Number(cfg.maxSessions) || 8)) {
      throw new Error(`too many live sessions (max ${cfg.maxSessions || 8}); close one first`);
    }
    const record = {
      id: `sess_${randomBytes(9).toString("hex")}`,
      token: randomBytes(24).toString("base64url"),
      profileId: profile.id ?? null,
      name: profile.name ?? `${profile.user ? profile.user + "@" : ""}${profile.host}`,
      host: profile.host,
      port: profile.port,
      user: profile.user,
      startedAt: new Date().toISOString(),
      channel: null,
      client: null,
      ws: null,
      backlog: [],
      backlogBytes: 0,
      closed: false,
      exit: null,
      motd: `Connected: ${profile.user ? profile.user + "@" : ""}${profile.host}:${profile.port}\r\n`,
    };
    const resolved = { host: profile.host, port: profile.port, user: profile.user, auth: profile.auth ?? { type: "password" } };
    const { base, host } = await buildConnectOptions(ctx, cfg, resolved, resolved.auth);
    base.hostVerifier = hostVerifierOf(store, host, profile.port, baseHostKeyPolicy(cfg));
    const { Client } = requireMod("ssh2");
    const client = new Client();
    let channel;
    try {
      channel = await new Promise((resolvePromise, rejectPromise) => {
        client.once("ready", () => {
          client.shell({ term: "xterm-256color", cols: 80, rows: 24 }, (err, stream) => {
            if (err) { rejectPromise(err); return; }
            resolvePromise(stream);
          });
        });
        client.once("error", (err) => rejectPromise(err));
        client.connect(base);
      });
    } catch (error) {
      try { client.end(); } catch { /* ignore */ }
      throw friendlyError(error);
    }
    record.client = client;
    record.channel = channel;
    sessions.set(record.id, record);
    channel.on("data", (chunk) => onData(record, chunk));
    if (channel.stderr) channel.stderr.on("data", (chunk) => onData(record, chunk));
    channel.on("exit", (code, signal) => { record.exit = { exitCode: code, signal: signal ?? null }; });
    channel.on("close", () => finish(record, record.exit?.exitCode ?? null, record.exit?.signal ?? null));
    client.on("error", (err) => {
      if (!record.closed) onData(record, `\r\n[ssh] ${friendlyError(err)}\r\n`);
    });
    return record;
  }

  function find(id) { return sessions.get(id) ?? null; }

  function attach(id, token, ws) {
    const rec = find(id);
    if (!rec) throw Object.assign(new Error("session not found"), { code: "NOT_FOUND" });
    if (rec.token !== token) throw Object.assign(new Error("bad session token"), { code: "FORBIDDEN" });
    rec.ws = ws;
    if (rec.closed) {
      sendFrame(ws, { type: "exit", exitCode: rec.exit?.exitCode ?? null, signal: rec.exit?.signal ?? null });
      try { ws.close(1000); } catch { /* ignore */ }
      return rec;
    }
    sendFrame(ws, { type: "out", data: Buffer.from(rec.motd, "utf8").toString("base64") });
    for (const chunk of rec.backlog) sendFrame(ws, { type: "out", data: Buffer.from(chunk, "utf8").toString("base64") });
    rec.backlog = [];
    rec.backlogBytes = 0;
    ws.on("close", () => { if (rec.ws === ws) rec.ws = null; });
    return rec;
  }

  function detach(id) {
    const rec = find(id);
    if (rec) rec.ws = null;
    return rec;
  }

  function input(id, dataB64) {
    const rec = find(id);
    if (!rec || rec.closed || !rec.channel) return false;
    try {
      rec.channel.write(Buffer.from(dataB64, "base64").toString("utf8"));
      return true;
    } catch { return false; }
  }

  function resize(id, cols, rows) {
    const rec = find(id);
    if (!rec || rec.closed || !rec.channel) return false;
    const c = Math.max(2, Math.min(1000, Math.floor(Number(cols) || 80)));
    const r = Math.max(2, Math.min(500, Math.floor(Number(rows) || 24)));
    try { rec.channel.setWindow(r, c, 0, 0); return true; } catch { return false; }
  }

  function close(id) {
    const rec = find(id);
    if (!rec) return false;
    rec.closed = true;
    rec.exit = rec.exit ?? { exitCode: null, signal: "closed" };
    if (rec.channel) { try { rec.channel.end(); } catch { /* ignore */ } }
    if (rec.client) { try { rec.client.end(); } catch { /* ignore */ } }
    if (rec.ws) { try { rec.ws.close(1000); } catch { /* ignore */ } }
    rec.ws = null;
    sessions.delete(id);
    return true;
  }

  function list() {
    const out = [];
    for (const rec of sessions.values()) {
      out.push({
        id: rec.id,
        profileId: rec.profileId,
        name: rec.name,
        host: rec.host,
        port: rec.port,
        user: rec.user,
        startedAt: rec.startedAt,
        status: rec.closed ? "exited" : "running",
        exitCode: rec.exit?.exitCode ?? null,
      });
    }
    return out;
  }

  function disposeAll() {
    for (const id of [...sessions.keys()]) close(id);
  }

  return { create, find, attach, detach, input, resize, close, list, disposeAll };
}
export async function removeProfileWithCreds(ctx, store, idOrName, clear = false) {
  const profile = store.findProfile(String(idOrName));
  if (!profile) throw new Error(`profile "${idOrName}" not found`);
  const refs = [];
  if (profile.auth?.passwordRef && profile.auth.type === "password") refs.push(profile.auth.passwordRef);
  if (profile.auth?.passphraseRef) refs.push(profile.auth.passphraseRef);
  const others = store.snapshot.profiles.filter((p) => p.id !== profile.id);
  const cleared = [];
  const skipped = [];
  if (clear) {
    for (const ref of [...new Set(refs)]) {
      const shared = others.some((p) => (p.auth?.passwordRef === ref) || (p.auth?.passphraseRef === ref));
      if (shared) { skipped.push({ ref, reason: "shared-with-other-profiles" }); continue; }
      try {
        const r = await unsetRef(ctx, ref);
        cleared.push(r.ref);
      } catch (error) {
        skipped.push({ ref, reason: error?.message ? String(error.message) : String(error) });
      }
    }
  }
  const removed = store.removeProfile(profile.id);
  return {
    removed: { id: removed.id, name: removed.name, host: removed.host },
    clearRequested: !!clear,
    refs,
    cleared,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// SFTP (over the same ssh2 client): list / upload / download.
// ---------------------------------------------------------------------------

async function connectSftp(ctx, store, cfg, targetSpec) {
  const resolved = await resolveTarget(ctx, store, cfg, targetSpec);
  const { base, host } = await buildConnectOptions(ctx, cfg, resolved, resolved.auth);
  base.hostVerifier = hostVerifierOf(store, host, resolved.port, baseHostKeyPolicy(cfg));
  const { Client } = requireMod("ssh2");
  const client = new Client();
  await new Promise((resolvePromise, rejectPromise) => {
    client.once("ready", resolvePromise);
    client.once("error", rejectPromise);
    client.connect(base);
  });
  const sftp = await new Promise((resolvePromise, rejectPromise) => {
    client.sftp((err, s) => (err ? rejectPromise(err) : resolvePromise(s)));
  });
  return { client, sftp, resolved };
}

function closeSftp(client) {
  try { client.end(); } catch { /* ignore */ }
}

function hostLabel(r) {
  return r.user ? `${r.user}@${r.host}:${r.port}` : `${r.host}:${r.port}`;
}

function statName(attrs) {
  if (!attrs) return "file";
  const m = attrs.mode;
  if (typeof m === "number") return m & 0o170000 ? (m & 0o170000) === 0o040000 ? "dir" : (m & 0o170000) === 0o120000 ? "link" : "file" : "file";
  return attrs.isDirectory ? "dir" : attrs.isFile ? "file" : "file";
}

/** List a remote directory. */
export async function sftpList(ctx, store, cfg, { target, path: remotePath }) {
  const dir = String(remotePath || ".").trim() || ".";
  const started = Date.now();
  const { client, sftp, resolved } = await connectSftp(ctx, store, cfg, target);
  try {
    const entries = await new Promise((resolvePromise, rejectPromise) => {
      sftp.readdir(dir, (err, list) => (err ? rejectPromise(err) : resolvePromise(list || [])));
    });
    return {
      ok: true,
      path: dir,
      entries: entries.map((e) => ({
        name: e.filename,
        type: e.attrs && e.attrs.isDirectory ? "dir" : e.attrs && e.attrs.isFile ? "file" : statName(e.attrs),
        size: e.attrs ? Number(e.attrs.size || 0) : 0,
        mtime: e.attrs && e.attrs.mtime ? new Date(e.attrs.mtime * 1000).toISOString() : null,
      })),
      durationMs: Date.now() - started,
      host: hostLabel(resolved),
      profileId: resolved.profile?.id ?? null,
    };
  } finally {
    closeSftp(client);
  }
}

async function ensureRemoteDir(sftp, dir) {
  if (!dir || dir === "/" || dir === ".") return;
  const isAbs = dir.startsWith("/");
  const segs = isAbs ? [""] : ["."];
  for (const part of dir.split("/").filter(Boolean)) {
    segs.push(part);
    const p = segs.join("/");
    await new Promise((resolvePromise, rejectPromise) => {
      sftp.stat(p, (err) => {
        if (!err) return resolvePromise();
        sftp.mkdir(p, (err2) => (err2 && err2.code !== "EEXIST" ? rejectPromise(err2) : resolvePromise()));
      });
    });
  }
}

/** Upload a local file to the remote host. */
export async function sftpUpload(ctx, store, cfg, { target, localPath, remotePath, ensureDir = false }) {
  const started = Date.now();
  if (!localPath || !remotePath) throw new Error("localPath and remotePath are required");
  const { client, sftp, resolved } = await connectSftp(ctx, store, cfg, target);
  try {
    if (!fsn.existsSync(localPath)) throw new Error(`local file not found: "${localPath}"`);
    const st = fsn.statSync(localPath);
    if (st.isDirectory()) throw new Error("localPath must be a file, not a directory");
    if (ensureDir) {
      const idx = remotePath.lastIndexOf("/");
      if (idx > 0) await ensureRemoteDir(sftp, remotePath.slice(0, idx));
    }
    const size = await new Promise((resolvePromise, rejectPromise) => {
      const out = sftp.createWriteStream(String(remotePath), { flags: "w" });
      const inp = fsn.createReadStream(localPath);
      inp.on("error", rejectPromise);
      out.on("error", rejectPromise);
      out.on("close", () => resolvePromise(st.size));
      inp.pipe(out);
    });
    return { ok: true, localPath, remotePath, bytes: size, durationMs: Date.now() - started, host: hostLabel(resolved), profileId: resolved.profile?.id ?? null };
  } finally {
    closeSftp(client);
  }
}

/** Download a remote file to the local machine. */
export async function sftpDownload(ctx, store, cfg, { target, remotePath, localPath, overwrite = false }) {
  const started = Date.now();
  if (!remotePath || !localPath) throw new Error("remotePath and localPath are required");
  const { client, sftp, resolved } = await connectSftp(ctx, store, cfg, target);
  try {
    const stat = await new Promise((resolvePromise, rejectPromise) => sftp.stat(String(remotePath), (err, s2) => (err ? rejectPromise(err) : resolvePromise(s2))));
    if (stat.isDirectory()) throw new Error("remotePath is a directory; use sftpList to browse");
    if (fsn.existsSync(localPath) && !overwrite) throw new Error(`local file exists ("${localPath}"); pass overwrite=true to replace`);
    fsn.mkdirSync(pathDirname(String(localPath)), { recursive: true });
    const size = await new Promise((resolvePromise, rejectPromise) => {
      const inp = sftp.createReadStream(String(remotePath));
      const out = fsn.createWriteStream(localPath, { flags: "w" });
      inp.on("error", rejectPromise);
      out.on("error", rejectPromise);
      out.on("close", () => resolvePromise(Number(stat.size || 0)));
      inp.pipe(out);
    });
    return { ok: true, remotePath, localPath, bytes: size, durationMs: Date.now() - started, host: hostLabel(resolved), profileId: resolved.profile?.id ?? null };
  } finally {
    closeSftp(client);
  }
}
