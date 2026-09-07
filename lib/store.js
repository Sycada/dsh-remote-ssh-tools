/**
 * dsh-remote-ssh — data store (profiles, prefs, host-key cache).
 *
 * Everything is JSON under `<DSH_HOME>/dsh-remote-ssh/store.json`
 * (DSH_HOME defaults to `~/.dsh`). This file NEVER holds secrets: password /
 * passphrase / private-key material lives in the DSH credentials center
 * (`~/.dsh/.credentials.yaml`, refs only) or in environment variables.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const STORE_VERSION = 1;

export function dshHomeOf() {
  return process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ""
    ? process.env.DSH_HOME
    : join(homedir(), ".dsh");
}

export function storePaths(cfg = {}) {
  const dir = join(dshHomeOf(), "dsh-remote-ssh");
  return { dir, file: join(dir, "store.json") };
}

/** Turn any user-supplied profile name into a stable credential ref suffix. */
export function refSuffixOf(name) {
  return String(name || "host")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "HOST";
}

export const defaultPasswordRef = (name) => `DSH_REMOTE_SSH_${refSuffixOf(name)}_PASSWORD`;
export const defaultPassphraseRef = (name) => `DSH_REMOTE_SSH_${refSuffixOf(name)}_PASSPHRASE`;

const PORT_RE = /^\d+$/;
/** DSH credential ref grammar (matches the DSH credentials center). */
const REF_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertRefName(ref, field) {
  if (ref !== undefined && ref !== null && ref !== "" && !REF_NAME_RE.test(ref)) {
    throw new Error(
      `${field} "${ref}" is not a valid credential reference — use only letters, digits and underscores, starting with a letter or underscore (e.g. DSH_REMOTE_SSH_TEST_PASSWORD)`
    );
  }
}

export function sanitizeProfile(input = {}, existing = null) {
  const base = existing ?? {};
  const name = String(input.name ?? base.name ?? "").trim();
  const host = String(input.host ?? base.host ?? "").trim().replace(/^\[|\]$/g, "");
  if (!name) throw new Error("profile name is required");
  if (!host) throw new Error("profile host is required");
  let port = input.port ?? base.port ?? 22;
  if (port !== 22 && !(PORT_RE.test(String(port)) && Number(port) >= 1 && Number(port) <= 65535)) {
    throw new Error(`profile port must be 1-65535, got ${JSON.stringify(input.port)}`);
  }
  port = port === "" || port === null || port === undefined ? 22 : Number(port);
  const auth = { ...(base.auth ?? {}), ...(input.auth ?? {}) };
  // accept top-level shorthand (authType / keyPath / passwordRef / passphraseRef)
  if (input.authType !== undefined && input.authType !== null) auth.type = String(input.authType);
  if (input.keyPath !== undefined && input.keyPath !== null) auth.keyPath = String(input.keyPath);
  if (input.passwordRef !== undefined && input.passwordRef !== null) auth.passwordRef = String(input.passwordRef);
  if (input.passphraseRef !== undefined && input.passphraseRef !== null) auth.passphraseRef = String(input.passphraseRef);
  const authType = auth.type ?? "agent";
  if (!["agent", "password", "key"].includes(authType)) {
    throw new Error(`auth.type must be agent|password|key, got ${JSON.stringify(authType)}`);
  }
  const keyPath = auth.keyPath ? String(auth.keyPath).trim() : "";
  if (authType === "key" && !keyPath) throw new Error("auth.type=key requires auth.keyPath");
  const passwordRef = (auth.passwordRef ?? defaultPasswordRef(name)).trim();
  const passphraseRef = (auth.passphraseRef ?? "").trim();
  assertRefName(passwordRef, "passwordRef");
  if (passphraseRef) assertRefName(passphraseRef, "passphraseRef");
  const now = new Date().toISOString();
  return {
    id: base.id ?? `ssh_${randomUUID().replace(/-/g, "")}`,
    name,
    group: String(input.group ?? base.group ?? "").trim(),
    host,
    port,
    user: String(input.user ?? base.user ?? "").trim(),
    notes: String(input.notes ?? base.notes ?? "").trim(),
    tags: Array.isArray(input.tags) ? input.tags.map(String) : Array.isArray(base.tags) ? base.tags.map(String) : [],
    auth: { type: authType, ...(keyPath ? { keyPath } : {}), passwordRef, ...(passphraseRef ? { passphraseRef } : {}) },
    created: base.created ?? now,
    updated: now,
  };
}

export function publicProfile(p) {
  return {
    id: p.id,
    name: p.name,
    group: p.group,
    host: p.host,
    port: p.port,
    user: p.user,
    notes: p.notes,
    tags: p.tags,
    auth: {
      type: p.auth.type,
      ...(p.auth.keyPath ? { keyPath: p.auth.keyPath } : {}),
      passwordRef: p.auth.passwordRef,
      ...(p.auth.passphraseRef ? { passphraseRef: p.auth.passphraseRef } : {}),
    },
    created: p.created,
    updated: p.updated,
  };
}

/**
 * Load the store (fresh defaults when absent). Returns a mutable snapshot;
 * call `writeStore` afterwards to persist.
 */
export function readStore(cfg = {}) {
  const { dir, file } = storePaths(cfg);
  const seed = {
    version: STORE_VERSION,
    profiles: [],
    hostKeys: {},
    created: new Date().toISOString(),
  };
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object") {
        return {
          version: STORE_VERSION,
          profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
          hostKeys: parsed.hostKeys && typeof parsed.hostKeys === "object" ? parsed.hostKeys : {},
          created: parsed.created ?? seed.created,
        };
      }
    }
  } catch {
    // corrupt store: start fresh rather than crash the plugin
  }
  return seed;
}

/** Persist the store atomically (temp file + rename). Never stores secrets. */
export function writeStore(store, cfg = {}) {
  const { dir, file } = storePaths(cfg);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.store.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n", "utf8");
  renameSync(tmp, file);
  try { mkdirSync(dir, { mode: 0o700 }); } catch { /* best effort on Windows */ }
}

/** Create the store service: in-memory snapshot + persistence + CRUD. */
export function createStore(cfg = {}) {
  const snapshot = readStore(cfg);
  const listeners = [];
  const emit = () => { for (const l of listeners) { try { l(); } catch { /* ignore */ } } };
  const api = {
    snapshot,
    save() {
      writeStore(snapshot, cfg);
      return api;
    },
    listProfiles() {
      return snapshot.profiles.map(publicProfile);
    },
    findProfile(idOrName) {
      return snapshot.profiles.find(
        (p) => p.id === idOrName || p.name === idOrName || `${p.name}@${p.host}` === idOrName
      );
    },
    upsertProfile(input, id) {
      const existing = id ? api.findProfile(id) : undefined;
      if (id && !existing) throw new Error(`profile "${id}" not found`);
      const profile = sanitizeProfile(input, existing);
      if (!id && api.findProfile(profile.name)) {
        throw new Error(`a profile named "${profile.name}" already exists`);
      }
      if (existing) {
        const idx = snapshot.profiles.findIndex((p) => p.id === existing.id);
        snapshot.profiles[idx] = profile;
      } else {
        snapshot.profiles.push(profile);
      }
      api.save();
      emit();
      return publicProfile(profile);
    },
    removeProfile(idOrName) {
      const idx = snapshot.profiles.findIndex(
        (p) => p.id === idOrName || p.name === idOrName
      );
      if (idx < 0) throw new Error(`profile "${idOrName}" not found`);
      const [removed] = snapshot.profiles.splice(idx, 1);
      api.save();
      emit();
      return publicProfile(removed);
    },
    /** host-key fingerprint cache: `${host}:${port}` -> fingerprint string */
    getHostKey(host, port) {
      const v = snapshot.hostKeys[`${host}:${port}`];
      return typeof v === "string" && v.length > 0 ? v : undefined;
    },
    setHostKey(host, port, fingerprint) {
      snapshot.hostKeys[`${host}:${port}`] = fingerprint;
      api.save();
      emit();
    },
    on(listener) {
      listeners.push(listener);
      return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); };
    },
  };
  return api;
}
