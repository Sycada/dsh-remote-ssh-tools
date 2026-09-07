# dev-assets

Development-only assets. NOT published (package.json "files" ships only lib/).

- `node_modules/` — fetched by npm; includes a prebuilt `node-pty` (needs the
  1.2.0-beta.15 prebuild for Windows) so the behavior tests exercise a real PTY.
- `@xterm/xterm` + `@xterm/addon-fit` — UMD dists copied into `../lib/assets/`
  for the self-hosted terminal page.

Running the dev tests requires `../node_modules` to resolve to this folder so
`lib/engine.js` can lazily `require('node-pty')` etc. On Windows create a junction:

    mklink /J ..\node_modules .\node_modules

then, from the package root:

    node dev-assets/smoke-test.cjs
    node dev-assets/behavior-test.cjs

Remove the junction afterwards (`rmdir ..\node_modules`).
