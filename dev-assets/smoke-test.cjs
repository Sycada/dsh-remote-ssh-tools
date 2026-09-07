
// Dev smoke test: import all plugin modules + store CRUD (needs dev-assets deps via junction)
const fs = require('fs'); const path = require('path');
process.env.DSH_HOME = fs.mkdtempSync(path.join(__dirname, 'smoke-'));
const base = 'file:///' + path.join(__dirname, '..', 'lib').replace(/\\/g, '/') + '/';
(async () => {
  const results = {};
  for (const f of ['store.js','engine.js','routes.js','tools.js','index.js']) {
    try { const m = await import(base + f); results[f] = 'ok(' + Object.keys(m).length + ')'; }
    catch (e) { results[f] = 'FAIL ' + String((e && e.message) || e); }
  }
  console.log('IMPORT', JSON.stringify(results));
  const store = await import(base + 'store.js');
  const api = store.createStore({});
  const a = api.upsertProfile({ name: 'demo', host: '10.0.0.5', user: 'root' });
  console.log('CRUD', a.id.slice(0,8), api.listProfiles().length, !!api.findProfile('demo'), !!api.removeProfile(a.id), api.listProfiles().length);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
