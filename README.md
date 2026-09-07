# dsh-remote-ssh

为 **DeepSeek Harness**（含 DSH Desktop）而生的 SSH 会话管理插件：集中保存连接档案，让 Agent 能一键连服务器执行命令、开交互终端、传文件——所有秘密只存 DSH 凭据中心，界面与对话中永不出现明文。

版本：**0.1.1** · License：MIT · 更新日志见 [CHANGELOG.md](CHANGELOG.md)

## 功能一览

- **连接档案管理**
  集中维护 SSH 档案（名称/分组/主机/端口/用户/认证方式/私钥路径/备注），随开随用。
- **Agent 一键执行（ssh_run）**
  对话里说"连生产服务器跑 df -h"，Agent 自动选档案执行并返回输出；支持退出码、stderr、超时、输出截断、主机密钥校验。
- **交互式终端**
  在设置页点"打开终端"，或在对话里让 Agent 用 `ssh_session_open` 打开——浏览器内 xterm 终端直连远端 shell，支持窗口缩放，会话跨页面刷新保活，关闭即结束远端会话。
- **文件传输（SFTP）**
  `ssh_sftp_upload / ssh_sftp_download / ssh_sftp_list`，上传可自动创建远端目录，下载默认防覆盖。
- **凭据安全**
  密码与私钥口令只以**引用名**写入 DSH 凭据中心（`~/.dsh/.credentials.yaml`）；档案、工具参数、系统提示词与输出中均不出现密钥值，密码也绝不进进程命令行。
- **主机密钥指纹缓存**
  首次连接自动记录指纹（accept-new），支持 strict 模式；指纹不符直接拒绝并提示（防中间人）。
- **即插即用的系统提示词**
  插件会向每个会话宣告可用工具与已存主机清单，Agent 无需任何配置即可在需要远程操作时自动选用。

## 安装

### 方式一：GitHub 依赖安装（推荐）

本插件通过 GitHub 仓库（Sycada/dsh-remote-ssh）发布，**未发布到 npm**。
⚠️ 注意：npm 上同名包 `dsh-remote-ssh`（0.1.0–0.2.4，Apache-2.0）属于另一个项目
（Yan-Zero/dsh-remote-ssh），`dsh plugin add dsh-remote-ssh` 或商店搜索会装错包，请勿使用。

在 DSH profile 的 `package.json` 中引用 GitHub 依赖并加入 bundle：

```jsonc
"dependencies": {
  "dsh-remote-ssh": "https://github.com/Sycada/dsh-remote-ssh.git#v0.1.1"
},
"dsh": { "profile": { "bundles": [ /* ...原有项... , "dsh-remote-ssh" ] } }
```

在 profile 目录执行 `pnpm install` 后**重启 DSH**。

### 方式二：本地文件依赖（开发/预发布验证）

将源码解压到本地目录，在 profile 的 `package.json` 中使用：

```jsonc
"dsh-remote-ssh": "file:D:/path/to/dsh-remote-ssh"
```

`pnpm install` 后重启；迭代改代码后需重跑 `pnpm install` 同步到安装副本。

1. 编辑 `~/.dsh/profiles/<profile名>/package.json`：
   - `dependencies` 增加：`"dsh-remote-ssh": "<版本号>"`
   - `dsh.profile.bundles` 增加：`"dsh-remote-ssh"`
2. 在 profile 目录执行 `pnpm install`
3. **重启 / 重载该 profile**（新增 bundle 属组合变更，重启最稳）

> 客户端模块由 DSH 自动发现并按内容哈希提供，无需重建 Harness 的 Web 壳。

安装后：设置左侧导航出现 **Remote SSH** 页面；Settings → Plugins 出现可折叠的 Remote SSH 卡片。

## 快速开始

1. 打开 **Settings → Remote SSH** → **新建档案**：填名称、主机、端口(默认22)、用户、认证方式。
2. 保存后，在下方 **设置凭据** 中为该档案保存密码/私钥口令（值进入 DSH 凭据中心，不回显）。
3. 点 **测试** 验证连通。
4. 三种用法随你选：
   - **Agent**：对话里说"用 test 档案跑 `uptime`"，或让 Agent `ssh_sftp_upload` 传文件；
   - **终端**：点"打开终端"，或让 Agent 执行 `ssh_session_open` 后用 `sidebar_open` 把终端页开进侧边栏；
   - **SFTP**：让 Agent 列出远端目录、上传/下载文件。

## Agent 工具（共 13 个）

| 工具 | 作用 |
|---|---|
| ssh_profile_list / add / update / remove | 档案增删改查 |
| ssh_profile_test | 连通性 + 认证快速探测 |
| ssh_secret_status | 只报告凭据引用是否已设置（永不显示值） |
| ssh_run | 远程执行一条命令并返回 stdout/stderr/退出码/耗时 |
| ssh_session_open / list / close | 交互会话：打开、列出、关闭 |
| ssh_sftp_list / upload / download | SFTP：列目录、上传（可自动建目录）、下载（默认防覆盖） |

约定：
- 目标优先用已保存的 **profile id**；也可直接给 host（+user/port/auth 引用）。
- **绝不要求用户把密码/密钥贴进对话**：只接受 `passwordRef` 等引用，值在凭据中心。
- 交互长任务（编辑器/tmux/服务日志）用 `ssh_session_open`；单条命令用 `ssh_run`。

## 凭据与安全设计

- 档案 JSON 不含任何秘密；密码/口令经 DSH 凭据中心保存（`~/.dsh/.credentials.yaml`，属主权限）。
- `密码引用`（passwordRef）是**引用名**而非密码本身；合法命名：字母/数字/下划线，以字母或下划线开头（如 `DSH_REMOTE_SSH_TEST_PASSWORD`）。非法命名在保存/写入前即被拒绝。
- 删除档案时可选"同时清除其凭据"；同一引用被多个档案共用时自动跳过，避免误删。
- ssh2 通道内认证（密码/私钥），密钥不进 argv/日志/工具输出；交互终端为纯 JS PTY 仿真（xterm），跨平台。
- 主机密钥：默认 accept-new 并缓存；`hostKeyPolicy: strict` 时未知主机拒绝、指纹不符报错。
- 全部 HTTP/WS 路由受 DSH 浏览器信任围栏保护；会话以不可猜 token 校验；卸载插件即断开全部会话。
- 命令超时、输出上限、并发会话数均有默认约束并可配置。

## 配置（cordis.patch.yml 中插件 config）

| 键 | 默认 | 说明 |
|---|---|---|
| sshPath | "" | 自定义 ssh 二进制路径（仅展示用；执行引擎为内置 ssh2） |
| connectTimeoutMs | 15000 | 连接超时 |
| keepaliveMs | 30000 | keepalive 间隔 |
| runTimeoutMs | 120000 | ssh_run 单命令超时 |
| runOutputLimit | 1048576 | stdout/stderr 上限（超出截断并标记） |
| maxSessions | 8 | 并发交互会话上限 |
| terminalScrollback | 5000 | 终端回滚行数（页面参数） |
| hostKeyPolicy | accept-new | accept-new | strict |
| trustedHosts | [] | 额外信任来源（LAN 部署时） |
| defaultUser | "" | 档案未指定用户时的默认用户 |

## 数据位置

- `~/.dsh/dsh-remote-ssh/store.json`：连接档案 + 主机密钥指纹缓存（原子写入）。
- `~/.dsh/.credentials.yaml`：凭据中心（各档案的密码/口令值，引用式）。
- 删除档案不会自动删除凭据，除非在删除确认中选择"删除并清除凭据"。

## 卸载

在插件管理中移除 bundle 并 `pnpm install`；如需彻底清理，再删除上面两个数据文件中的相关条目。

## FAQ

- **提示 "no password available … set credential"**：该档案密码尚未在凭据中心/环境变量中设置——到 Remote SSH 设置页的"设置凭据"区填写，或设置同名环境变量。
- **终端一直打不开/白屏**：请确保重启过 profile（客户端与宿主端代码随重启加载）；仍异常时把该窗口 DevTools 控制台报错发来。
- **agent 转发（ssh -A）**：v0.1 交互引擎暂不支持，后续可作为可选模式。
- **能否连跳板机/做端口转发**：规划中（v0.2+）。

## 兼容性

- 依赖 DSH（含 Desktop）≥ 0.1.1-rc.1；Node ≥ 20。
- 执行引擎为纯 JS ssh2 + xterm，Windows / macOS / Linux 均可运行交互终端。

## License

MIT
