# dsh-remote-ssh

SSH session manager for **DeepSeek Harness** (incl. DSH Desktop). Save connection
profiles once; let the agent run commands, open interactive terminals, and move
files — while secrets live only in the DSH credential center.

Version: **0.1.1** · License: MIT · Changelog: [CHANGELOG.md](CHANGELOG.md)

## Features

- **Profiles** — hosts, ports, users, auth types (password / key / agent), groups, notes.
- **Agent one-shot runs** — `ssh_run`: stdout/stderr/exit code, timeouts, output caps, host-key checks.
- **Interactive terminals** — browser xterm over a pure-JS ssh2 shell channel; resizable; survives page refresh; closing kills the session.
- **SFTP** — `ssh_sftp_list/upload/download`; upload can create remote dirs, download refuses to overwrite by default.
- **Secret-safe** — profiles store only credential *refs*; values live in `~/.dsh/.credentials.yaml`; never in argv, chat, tool output or prompts.
- **Host-key fingerprint cache** — accept-new by default, `strict` rejects unknown/mismatched keys.
- **Zero-config for agents** — a system-prompt section advertises tools and saved hosts in every session.

## Install

This plugin is released via the GitHub repo (Sycada/dsh-remote-ssh) and is **not published to
npm**. ⚠️ The npm package named `dsh-remote-ssh` (0.1.0–0.2.4, Apache-2.0) belongs to a different
project (Yan-Zero/dsh-remote-ssh) — `dsh plugin add dsh-remote-ssh` or a store search installs
the wrong package. Use a GitHub dependency instead:

```jsonc
"dependencies": { "dsh-remote-ssh": "https://github.com/Sycada/dsh-remote-ssh.git#v0.1.1" },
"dsh": { "profile": { "bundles": [ /* existing… */ "dsh-remote-ssh" ] } }
```

Run `pnpm install` in the profile dir, then **restart DSH**. For local iteration use a
`file:` specifier pointing at a source checkout.

After restart: Settings → left nav shows **Remote SSH**; Settings → Plugins lists a collapsible Remote SSH card.

## Quick start

1. **Settings → Remote SSH → New profile** (name/host/port/user/auth).
2. Save, then set its password/passphrase under **Set credentials**.
3. Click **Test**.
4. Use it: ask the agent to run `uptime` on the profile, open a terminal
   (`ssh_session_open` + `sidebar_open`), or transfer files (`ssh_sftp_*`).

## Agent tools (13)

`ssh_profile_list/add/update/remove` · `ssh_profile_test` · `ssh_secret_status` ·
`ssh_run` · `ssh_session_open/list/close` · `ssh_sftp_list/upload/download`

Never paste secrets into chat — pass `passwordRef`/refs; values live in the credential center.

## Security & data

- No secret text in profile JSON; credential refs must match
  `^[A-Za-z_][A-Za-z0-9_]*$` and are validated before any write.
- Deleting a profile may optionally also clear its credential lines; refs shared
  with other profiles are skipped automatically.
- HTTP/WS routes sit behind the DSH browser-trust fence; sessions use unguessable tokens.
- Data: `~/.dsh/dsh-remote-ssh/store.json` (profiles + host-key cache),
  `~/.dsh/.credentials.yaml` (credential center).

## Config (profile cordis.patch.yml → dsh-remote-ssh config)

`sshPath`, `connectTimeoutMs`, `keepaliveMs`, `runTimeoutMs`, `runOutputLimit`,
`maxSessions`, `terminalScrollback`, `hostKeyPolicy` (accept-new|strict),
`trustedHosts`, `defaultUser`.

## Compatibility

Pure JS ssh2 + xterm terminal: Windows / macOS / Linux. Requires DSH ≥ 0.1.1-rc.1, Node ≥ 20.

## License

MIT
