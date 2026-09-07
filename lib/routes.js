/**
 * dsh-remote-ssh — HTTP REST bridge, WebSocket terminal bridge, asset + page
 * serving. All routes hang under the plugin-owned prefix /dsh-remote-ssh and
 * every request passes a browser-trust fence (loopback or configured
 * trustedHosts), matching the containment posture of the /api gateway.
 *
 * Wire protocol for /dsh-remote-ssh/ws (JSON text frames):
 *   client -> server: {type:'input', data:<base64>} {type:'resize',cols,rows} {type:'close'}
 *   server -> client: {type:'out', data:<base64>} {type:'exit',exitCode,signal} {type:'error',message}
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand, setRef, removeProfileWithCreds } from "./engine.js";

const requireWs = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(__dirname, "assets");
const ASSET_TYPES = {
  "xterm.js": "text/javascript; charset=utf-8",
  "addon-fit.js": "text/javascript; charset=utf-8",
  "xterm.css": "text/css; charset=utf-8",
};

function loopbackish(address = "") {
  const a = String(address).toLowerCase();
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1" || a.startsWith("127.");
}

function hostnameOf(req) {
  const host = String(req.headers?.host ?? "");
  const withoutPort = host.replace(/^\[|\]$/g, "").split(":")[0].toLowerCase();
  return withoutPort || "";
}

/** Browser-trust fence: loopback peers are always trusted; else cfg.trustedHosts. */
export function fence(req, cfg = {}) {
  if (loopbackish(req.socket?.remoteAddress)) return true;
  const host = hostnameOf(req);
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") return true;
  const trusted = Array.isArray(cfg.trustedHosts) ? cfg.trustedHosts.map((h) => String(h).toLowerCase()) : [];
  return trusted.includes(host) || trusted.includes(String(req.headers?.host ?? "").toLowerCase());
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}

function sendError(res, code, message, httpCode = 400) {
  sendJson(res, httpCode, { error: message, ok: false });
}

function readJsonBody(req, limit = 65536) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        rejectPromise(Object.assign(new Error("request body too large"), { code: "TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) { resolvePromise({}); return; }
      try { resolvePromise(JSON.parse(raw)); } catch { rejectPromise(new Error("invalid JSON body")); }
    });
    req.on("error", rejectPromise);
  });
}

const TEST_COMMAND = "echo CONNECT_OK && whoami && hostname && uname -srm 2>/dev/null || uname -srm";

function segmentPath(pathname) {
  return pathname.split("/").filter(Boolean);
}

/** Absolute page URL for one session, best-effort from the request host. */
function pageUrlFor(record, req) {
  const path = pagePathFor(record);
  const host = String(req?.headers?.host ?? "127.0.0.1");
  return { path, url: `http://${host}${path}` };
}

export function pagePathFor(record) {
  return `/dsh-remote-ssh/terminal?id=${encodeURIComponent(record.id)}&token=${encodeURIComponent(record.token)}`;
}

export function registerRoutes(ctx, { store, engine, cfg, getState }) {
  const disposers = [];

  // ---------- HTTP API (single prefix route, plugin-owned) ----------
  disposers.push(
    ctx.webServer.register({
      kind: "prefix",
      path: "/dsh-remote-ssh/api",
      handler: async (req, res) => {
        if (!fence(req, cfg)) return sendError(res, "forbidden", "forbidden", 403);
        try {
          const method = (req.method || "GET").toUpperCase();
          // The DSH webserver hands prefix handlers the FULL pathname
          // (mount prefix included), so strip our own mount prefix first.
          let pathname = (req.url ?? "/").split("?")[0];
          const guard = "/dsh-remote-ssh/api";
          while (pathname.startsWith(guard)) pathname = pathname.slice(guard.length);
          if (!pathname.startsWith("/")) pathname = "/" + pathname;
          const seg = segmentPath(pathname);

          if (seg.length === 1 && seg[0] === "state" && method === "GET") {
            return sendJson(res, 200, { ok: true, data: await getState(ctx) });
          }
          if (seg.length === 1 && seg[0] === "profiles" && method === "GET") {
            return sendJson(res, 200, { ok: true, profiles: store.listProfiles() });
          }
          if (seg.length === 1 && seg[0] === "profiles" && method === "POST") {
            const body = await readJsonBody(req);
            const profile = store.upsertProfile(body.profile ?? body);
            return sendJson(res, 200, { ok: true, profile });
          }
          if (seg.length === 1 && seg[0] === "profiles" && method === "PUT") {
            return sendError(res, "method", "use POST with a body (id field) or PUT /profiles/:id", 405);
          }
          if (seg.length === 2 && seg[0] === "profiles" && method === "PUT") {
            const body = await readJsonBody(req);
            const profile = store.upsertProfile(body.profile ?? body, seg[1]);
            return sendJson(res, 200, { ok: true, profile });
          }
          if (seg.length === 2 && seg[0] === "profiles" && method === "DELETE") {
            const clearParam = new URL(req.url ?? "/", "http://dsh.internal").searchParams.get("clear");
            const clear = clearParam === "1" || clearParam === "true";
            const report = await removeProfileWithCreds(ctx, store, seg[1], clear);
            return sendJson(res, 200, { ok: true, ...report });
          }
          if (seg.length === 2 && seg[0] === "profiles" && seg[2] === undefined && method === "POST") {
            const body = await readJsonBody(req);
            if (body.action === "test") {
              const spec = body.profile ? { profile: body.profile } : body.target ?? {};
              const out = await runTest(ctx, store, cfg, spec);
              return sendJson(res, 200, { ok: out.ok, ...out });
            }
            if (body.action === "secret") {
              const kind = body.kind === "passphrase" ? "passphrase" : "password";
              const found = store.findProfile(seg[1]);
              if (!found) return sendError(res, "profile", `profile "${seg[1]}" not found`, 404);
              const ref = kind === "passphrase" ? found.auth.passphraseRef : found.auth.passwordRef;
              if (!ref) return sendError(res, "ref", `profile has no ${kind} ref configured`);
              await setSecretRef(ctx, ref, body.value ?? "");
              return sendJson(res, 200, { ok: true, kind, ref });
            }
            return sendError(res, "action", "unknown action; use test or secret");
          }
          if (seg.length === 3 && seg[0] === "profiles" && seg[2] === "test" && method === "POST") {
            const body = await readJsonBody(req);
            const out = await runTest(ctx, store, cfg, { profile: seg[1], ...(body?.command ? { command: body.command } : {}) });
            return sendJson(res, 200, { ok: out.ok, ...out });
          }
          if (seg.length === 3 && seg[0] === "profiles" && seg[2] === "secret" && method === "POST") {
            const body = await readJsonBody(req);
            const kind = body.kind === "passphrase" ? "passphrase" : "password";
            const found = store.findProfile(seg[1]);
            if (!found) return sendError(res, "profile", `profile "${seg[1]}" not found`, 404);
            const ref = kind === "passphrase" ? found.auth.passphraseRef : found.auth.passwordRef;
            if (!ref) return sendError(res, "ref", `profile has no ${kind} ref configured`);
            await setSecretRef(ctx, ref, body.value ?? "");
            return sendJson(res, 200, { ok: true, kind, ref });
          }
          if (seg.length === 1 && seg[0] === "sessions" && method === "GET") {
            return sendJson(res, 200, { ok: true, sessions: engine.list() });
          }
          if (seg.length === 1 && seg[0] === "sessions" && method === "POST") {
            const body = await readJsonBody(req);
            const profile = store.findProfile(body.profile ?? body.profileId);
            if (!profile) return sendError(res, "profile", "profile not found", 404);
            const record = await engine.create(profile);
            return sendJson(res, 200, { ok: true, session: sessionPublic(record), page: pageUrlFor(record, req) });
          }
          if (seg.length === 2 && seg[0] === "sessions" && seg[1] && method === "DELETE") {
            engine.close(seg[1]);
            return sendJson(res, 200, { ok: true, closed: seg[1] });
          }
          return sendError(res, "not-found", `no API route for ${method} /dsh-remote-ssh/api/${seg.join("/")}`, 404);
        } catch (error) {
          return sendError(res, "error", error && error.message ? error.message : String(error), 400);
        }
      },
    })
  );

  // ---------- WebSocket terminal bridge ----------
  disposers.push(
    ctx.webServer.registerUpgrade({
      path: "/dsh-remote-ssh/ws",
      handler: (req, socket, head) => {
        if (!fence(req, cfg)) { socket.destroy(); return; }
        const query = new URL(req.url ?? "/", "http://dsh.internal").searchParams;
        const id = query.get("id");
        const token = query.get("token");
        if (!id || !token) { socket.destroy(); return; }
        let WS;
        try { WS = requireWs("ws"); } catch { socket.destroy(); return; }
        const server = new WS.WebSocketServer({ noServer: true });
        server.handleUpgrade(req, socket, head, (ws) => {
          try {
            const rec = engine.attach(id, token, ws);
            ws.on("message", (raw) => {
              let frame;
              try { frame = JSON.parse(String(raw)); } catch { return; }
              if (!frame || typeof frame !== "object") return;
              if (frame.type === "input" && typeof frame.data === "string") {
                engine.input(rec.id, frame.data);
              } else if (frame.type === "resize") {
                engine.resize(rec.id, frame.cols, frame.rows);
              } else if (frame.type === "close") {
                engine.close(rec.id);
                try { ws.close(1000); } catch { /* ignore */ }
              }
            });
            ws.on("close", () => engine.detach(rec.id));
            ws.on("error", () => engine.detach(rec.id));
          } catch (error) {
            ws.close(1011, error && error.message ? String(error.message).slice(0, 200) : "attach failed");
          }
        });
      },
    })
  );

  // ---------- terminal page ----------
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/dsh-remote-ssh/terminal",
      handler: (req, res) => {
        if (!fence(req, cfg)) { res.writeHead(403); res.end("forbidden"); return; }
        const html = readFileSync(join(ASSET_DIR, "terminal.html"), "utf8");
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        });
        res.end(html);
      },
    })
  );

  // ---------- static assets ----------
  disposers.push(
    ctx.webServer.register({
      kind: "prefix",
      path: "/dsh-remote-ssh/assets",
      handler: (req, res) => {
        if (!fence(req, cfg)) { res.writeHead(403); res.end("forbidden"); return; }
        // The DSH webserver hands prefix handlers the FULL path (mount prefix
        // included) — strip our own "/dsh-remote-ssh/assets/" mount first.
        const raw = (req.url ?? "").split("?")[0];
        const prefix = "/dsh-remote-ssh/assets/";
        const name = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw.replace(/^\//, "");
        const type = ASSET_TYPES[name];
        if (!type) { res.writeHead(404); res.end("not found"); return; }
        try {
          const body = readFileSync(join(ASSET_DIR, name));
          res.writeHead(200, {
            "content-type": type,
            "cache-control": "no-cache",
            "x-content-type-options": "nosniff",
          });
          res.end(body);
        } catch {
          res.writeHead(404); res.end("not found");
        }
      },
    })
  );

  const teardown = () => { for (const d of disposers) { try { d(); } catch { /* ignore */ } } };
  return { disposers, teardown };
}

function sessionPublic(rec) {
  return {
    id: rec.id,
    profileId: rec.profileId,
    name: rec.name,
    host: rec.host,
    port: rec.port,
    user: rec.user,
    startedAt: rec.startedAt,
    status: rec.closed ? "exited" : "running",
    exitCode: rec.exit?.exitCode ?? null,
  };
}

async function setSecretRef(ctx, ref, value) {
  await setRef(ctx, ref, value);
}

async function runTest(ctx, store, cfg, spec) {
  const target = spec.profile ? { profile: spec.profile } : { host: spec.host, port: spec.port, user: spec.user, auth: spec.auth };
  const out = await runCommand(ctx, store, cfg, { target, command: spec.command && String(spec.command).length ? String(spec.command) : TEST_COMMAND, timeoutMs: cfg.connectTimeoutMs ? cfg.connectTimeoutMs + 5000 : 20000 });
  return out;
}
