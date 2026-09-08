# Changelog

## 0.1.2 — 2026-09-07

### Changed

- Package renamed from `dsh-remote-ssh` to `dsh-remote-ssh-tools` (the npm name
  `dsh-remote-ssh` belongs to an unrelated project). Plugin id, cordis patch entry,
  HTTP URL prefixes, settings-card ids, data directory and credential-ref prefix all
  follow the new name:
  - data dir: `~/.dsh/dsh-remote-ssh/` → `~/.dsh/dsh-remote-ssh-tools/`
  - credential refs: `DSH_REMOTE_SSH_*` → `DSH_REMOTE_SSH_TOOLS_*` (applies to new
    ad-hoc host defaults; existing saved profiles keep their stored refs)
- Existing profiles can be migrated by copying `~/.dsh/dsh-remote-ssh/store.json`
  to `~/.dsh/dsh-remote-ssh-tools/store.json` before the first start of 0.1.2.

## 0.1.1 — 2026-09-07

### Fixed

- **All 13 agent tools now declare `output.render`** (ssh_profile_list, ssh_profile_add,
  ssh_profile_update, ssh_profile_remove, ssh_profile_test, ssh_secret_status, ssh_run,
  ssh_session_open, ssh_session_list, ssh_session_close, ssh_sftp_list, ssh_sftp_upload,
  ssh_sftp_download). Previously `defineTool` wrapped a missing render and every tool call
  failed with `output.render failed: userRender is not a function` even though the SSH
  work succeeded. Each render formats a readable text summary (host / exit code / stdout /
  stderr / truncation / paths / bytes) and never throws on replayed or malformed values.
- **Profile deletion no longer crashes with `refsn is not defined`** (settings card DELETE and
  `ssh_profile_remove`): `engine.js` `removeProfileWithCreds` declared `refs` but pushed via
  the typo `refsn`, throwing a ReferenceError before the profile was removed.
- **Tool output schemas now match what the store/engine actually return** (the harness rejects
  undeclared fields and nulls): `PROFILE_ITEM` declares `created`/`updated`; nullable fields
  (`ssh_run.exitCode/profileId`, `ssh_profile_test.exitCode`, `ssh_session_list.exitCode/profileId`,
  `ssh_sftp_list.mtime/profileId`, `ssh_sftp_upload/download.profileId`) use `oneOf` with null;
  `ssh_profile_remove.removed` declares `id`. Fixes
  `"value.profiles[0].created" is not a declared property` on `ssh_profile_list` etc.
- **ssh_session_open no longer crashes with "cannot get property webServer without
  inject"**: the tool read the port via `ctx.webServer?.listenedPort`, but webServer is a
  cordis service and must be reached through `ctx.get("webServer")`; direct property access
  throws in the harness. Now resolved via `ctx.get` with a 43120 fallback.
- **ssh_profile_update partial updates now work as documented** ("omit fields to keep
  them"): only provided non-empty fields are patched; omitted fields are preserved instead
  of being blanked, and the execute now returns `{ ok: true, profile }` instead of undefined.

## 0.1.0 — initial release

SSH session manager for DeepSeek Harness: connection profiles (secrets by reference only),
non-interactive `ssh_run`, interactive terminals (node-pty + OpenSSH, xterm over WebSocket),
SFTP list/upload/download, and a Settings card.
