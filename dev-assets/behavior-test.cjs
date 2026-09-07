
// Dev behavior test: real node-pty + OpenSSH lifecycle (no remote server needed)
const fs = require('fs'); const path = require('path');
process.env.DSH_HOME = fs.mkdtempSync(path.join(__dirname, 'beh-'));
const base = 'file:///' + path.join(__dirname, '..', 'lib').replace(/\\/g, '/') + '/';
// Dev behavior test: engine paths that need no reachable server.
(async () => {
  const { createSessionManager, runCommand, resolveRef } = await import(base + 'engine.js');
  const { createStore } = await import(base + 'store.js');
  const store = createStore({});
  const mgr = createSessionManager(null, store, { maxSessions: 4, connectTimeoutMs: 4000, hostKeyPolicy: 'accept-new' });

  // refused host: create() must reject with a friendly connection error
  let refusedMsg = '';
  try {
    await mgr.create({ id: 'p1', name: 'probe', host: '127.0.0.1', port: 1, user: 'nobody', auth: { type: 'password', passwordRef: 'X_DSH_BEHAVIOR_REF' } });
  } catch (e) { refusedMsg = e.message; }
  process.env.X_DSH_BEHAVIOR_REF = 'pw-value';
  console.log('REFUSED create rejects:', /refused|timeout/i.test(refusedMsg), '|', refusedMsg.slice(0, 90));

  // missing password gate (config-class error surfaces on the caller)
  let noCredMsg = '';
  try {
    await runCommand(null, store, { connectTimeoutMs: 4000, runTimeoutMs: 8000, runOutputLimit: 100000 }, { target: { host: '127.0.0.1', port: 1, user: 'nobody', auth: { type: 'password', passwordRef: 'X_DSH_NOPE' } }, command: 'echo hi' });
  } catch (e) { noCredMsg = e.message; }
  console.log('NO_CRED gate:', /credential/.test(noCredMsg));

  // runCommand against a closed port -> structured ok:false with friendly stderr
  const out = await runCommand(null, store, { connectTimeoutMs: 4000, runTimeoutMs: 8000, runOutputLimit: 100000 }, { target: { host: '127.0.0.1', port: 1, user: 'nobody', auth: { type: 'password', passwordRef: 'X_DSH_BEHAVIOR_REF' } }, command: 'echo hi' });
  console.log('REFUSED run ok=false:', out.ok === false, '| stderr:', out.stderr);

  console.log('RESOLVE env fallback:', (await resolveRef(null, 'X_DSH_BEHAVIOR_REF')) === 'pw-value');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
