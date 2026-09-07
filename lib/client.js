window.__ModuleLoader__.load({
  id: "dsh-remote-ssh",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    let ui = require("@deepseek-ai/dsh-client-ui-primitives");
    const css = ".drssh-item{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));transition:border-color .16s,background .16s;overflow:hidden;margin:6px 0}.drssh-item.open{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))}.drssh-itemHead{width:100%;display:flex;align-items:center;gap:10px;padding:10px 14px;background:transparent;border:0;cursor:pointer;color:inherit;font:inherit;text-align:left}.drssh-itemHead:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06))}.drssh-itemTitle{flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,inherit);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.drssh-itemSub{color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.8));font-size:12.5px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.drssh-chev{flex:none;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.8));transition:transform .16s}.drssh-itemBody{padding:2px 14px 14px;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28))}.drssh-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.drssh-fieldRow{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28))}.drssh-fieldRow:first-of-type{border-top:0}.drssh-fieldLabel{font-size:13px;color:var(--dsw-alias-label-secondary,inherit)}.drssh-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.8))}.drssh-act{appearance:none;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;background:transparent;color:var(--dsw-alias-label-primary,inherit)}.drssh-act:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}.drssh-act:disabled{opacity:.4;cursor:default}.drssh-act.primary{background:var(--dsw-alias-label-primary,currentColor);color:var(--dsw-alias-bg-layer-3,#fff)}.drssh-act.primary:hover:not(:disabled){filter:brightness(1.08)}.drssh-act.danger{color:var(--dsw-alias-state-error-primary,#e5484d)}.drssh-act.primary.danger{background:var(--dsw-alias-state-error-primary,#e5484d);color:var(--dsw-alias-bg-layer-3,#fff)}.drssh-act.mini{font-size:12px;padding:2px 9px;border-radius:7px;color:var(--dsw-alias-label-secondary,inherit)}.drssh-act.mini:hover:not(:disabled){color:var(--dsw-alias-label-primary,inherit)}.drssh-act.mini.danger{color:var(--dsw-alias-state-error-primary,#e5484d)}.drssh-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 0 0}.drssh-sep{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));margin:8px 0}.drssh-list{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));border-radius:10px;overflow:hidden;margin:2px 0}.drssh-pro{display:flex;align-items:center;gap:8px;padding:9px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}.drssh-pro:first-child{border-top:0}.drssh-pro:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.05))}.drssh-proMain{flex:1;min-width:0}.drssh-proName{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,inherit)}.drssh-proMeta{font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.8))}.drssh-dot{flex:none;width:8px;height:8px;border-radius:50%}.drssh-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}.drssh-grow{flex:1}.drssh-err{color:var(--dsw-alias-state-error-primary,#e5484d);font-size:12.5px}.drssh-ok{color:var(--dsw-alias-state-success-primary,#30a46c);font-size:12.5px}.drssh-empty{padding:14px 2px;font-size:13px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.8))}";
    if (typeof document !== "undefined" && !document.getElementById("drssh-css")) {
      const s = document.createElement("style"); s.id = "drssh-css"; s.textContent = css; document.head.appendChild(s);
    }
    const RAW = {"title":["远程 SSH","Remote SSH"],"desc":["连接档案 / 远程执行 / 交互终端。密码与私钥口令存 DSH 凭据中心，不在本页落明文。","Profiles / remote execution / interactive terminals. Secrets live in the DSH credential center."],"add":["新建档案","New profile"],"refresh":["刷新","Refresh"],"save":["保存","Save"],"cancel":["取消","Cancel"],"edit":["编辑","Edit"],"remove":["删除","Delete"],"test":["测试","Test"],"terminal":["打开终端","Terminal"],"copy":["复制链接","Copy link"],"close":["关闭","Close"],"empty":["还没有档案。添加后即可让 agent 用 ssh_run / ssh_session_open 直接连接。","No profiles yet. Add one, then the agent can connect via ssh_run / ssh_session_open."],"sessions":["活动会话","Live sessions"],"noSessions":["暂无","None"],"authPassword":["密码","Password"],"authKey":["密钥","Key"],"authAgent":["Agent","Agent"],"credSet":["已设置","set"],"credMissing":["未设置","missing"],"setPasswordTitle":["设置凭据","Set credentials"],"savePassword":["保存密码","Save password"],"savePassphrase":["保存口令","Save passphrase"],"passwordPh":["密码（不回显）","Password (never echoed)"],"passphrasePh":["私钥口令","Key passphrase"],"host":["主机","Host"],"user":["用户","User"],"group":["分组","Group"],"name":["名称","Name"],"port":["端口","Port"],"authType":["认证","Auth"],"keyPath":["私钥路径","Key path"],"passwordRef":["密码引用","Password ref"],"passphraseRef":["口令引用","Passphrase ref"],"notes":["备注","Notes"],"required":["名称与主机为必填项","Name and host are required"],"refRule":["密码引用需以字母或下划线开头，仅含字母/数字/下划线（如 DSH_REMOTE_SSH_TEST_PASSWORD）","Password ref must start with a letter/underscore and contain only letters, digits and underscores (e.g. DSH_REMOTE_SSH_TEST_PASSWORD)"],"delAsk":["删除档案","Delete profile"],"delAskName":["确定删除档案","Delete profile"],"delOnly":["仅删除档案","Delete only"],"delWithCred":["删除并清除凭据","Delete + clear credentials"],"delCancel":["取消","Cancel"],"delCredHint":["会清除 .credentials.yaml 中该档案的密码/口令行（被其他档案共用的引用会自动跳过）","Clears this profile's password/passphrase lines in .credentials.yaml (shared refs are skipped)"],"delDone":["已删除","Deleted"],"delCleared":["已清除凭据","credentials cleared"],"delSkipped":["跳过的引用","skipped refs"],"refNote":["档案保存后，再到下方“设置凭据”为该档案填写密码/口令（值只进凭据中心，本页不落明文）","After saving the profile, fill its password/passphrase below under \"Set credentials\" (values only go to the credential center)"],"secretSet":["已填写","filled"],"secretMissing":["未填写","empty"],"secretPlaceholder":["已填写 · 如需修改请直接输入新值","filled · type to change"],"secretTypeHint":["输入新值后点保存即覆盖","Type a new value and press Save to overwrite"],"testing":["测试中…","Testing…"],"testOk":["连接成功","Connected"],"copied":["已复制","Copied"],"settings":["设置","Settings"],"settingsHint":["偏好可在 profile 的 cordis.patch.yml（dsh-remote-ssh config）中调整。","Preferences live in the profile cordis.patch.yml (dsh-remote-ssh config)."]};
    const T = (function () { const zh = typeof navigator !== "undefined" && /^zh/i.test(navigator.language || ""); const o = {}; for (const [k, p] of Object.entries(RAW)) o[k] = zh ? p[0] : p[1]; return o; })();
    const h = react.createElement;
    async function api(path, options) {
      const res = await fetch("/dsh-remote-ssh/api" + path, { headers: { "content-type": "application/json" }, ...options });
      let data = null; try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok || !data || data.ok === false) {
        const pick = data && (data.error || data.message || data.stderr || data.stdout);
        throw new Error((typeof pick === "string" && pick ? pick.slice(0, 400) : "") || ("HTTP " + res.status));
      }
      return data;
    }
    const CHEVRON = (open) => h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", className: "drssh-chev", style: { transform: open ? "rotate(180deg)" : "none" } },
      h("path", { d: "M4 6l4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
    const ACT = (p) => h("button", {
      type: "button",
      className: ["drssh-act", p.primary ? "primary" : "", p.danger ? "danger" : "", p.mini ? "mini" : ""].filter(Boolean).join(" "),
      onClick: p.onClick,
      disabled: p.disabled,
    }, p.label);
    const EMPTY = { id: "", name: "", host: "", port: "22", user: "", group: "", authType: "password", keyPath: "", passwordRef: "", passphraseRef: "", notes: "" };
    const Input = ui.Input;

    function ProfileForm({ form, setForm, onSave, onCancel, busy }) {
      const QF = (label, key, placeholder) => h("div", { className: "drssh-fieldRow", key: key },
        h("div", { className: "drssh-fieldLabel", style: { color: "var(--dsw-alias-label-tertiary,rgba(127,127,127,.8))", fontSize: 12, fontWeight: 400 } }, label),
        h(Input, { type: "text", value: form[key] ?? "", placeholder: placeholder || "A-Za-z0-9_", onChange: (e) => setForm({ ...form, [key]: e.target.value }), style: { fontSize: 12, opacity: 0.85 } })
      );

      const F = (label, key, type, placeholder) => h("div", { className: "drssh-fieldRow", key: key },
        h("div", { className: "drssh-fieldLabel" }, label),
        h(Input, { type: type || "text", value: form[key] ?? "", placeholder: placeholder || (type === "password" ? T.passwordPh : ""), onChange: (e) => setForm({ ...form, [key]: e.target.value }) }));
      const SEL = () => h("div", { className: "drssh-fieldRow", key: "authType" },
        h("div", { className: "drssh-fieldLabel" }, T.authType),
        h("select", { value: form.authType, onChange: (e) => setForm({ ...form, authType: e.target.value }), style: { font: "inherit", fontSize: 13, borderRadius: 8, padding: "6px 10px", border: "1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35))", background: "var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))", color: "var(--dsw-alias-label-primary,inherit)" } },
          ["agent", "password", "key"].map((v) => h("option", { key: v, value: v }, v))));
      return h("div", null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0 16px" } },
          F(T.name, "name"), F(T.host, "host"), F(T.port, "port", "number"), F(T.user, "user"), F(T.group, "group"), SEL(), form.authType === "key" && F(T.keyPath, "keyPath"),
          (form.authType === "password" || form.authType === "key") && QF(T.passwordRef, "passwordRef", "A-Za-z0-9_ / 默认自动生成"),
          form.authType === "key" && QF(T.passphraseRef, "passphraseRef", "A-Za-z0-9_ / 默认自动生成"),
          F(T.notes, "notes")
        ),
        (form.authType === "password" || form.authType === "key") && h("div", { className: "drssh-hint", style: { margin: "2px 0 0" } }, T.refNote),
        h("div", { className: "drssh-foot" },
          ACT({ label: T.save, primary: true, onClick: onSave, disabled: busy === "save" }),
          ACT({ label: T.cancel, onClick: onCancel })
        )
      );
    }

        function SecretRows({ profiles, pw, setPw, busy, saveSecret }) {
      const rows = profiles.filter((p) => p.auth.type === "password" || p.auth.passphraseRef);
      if (!rows.length) return null;
      return h("div", null,
        h("div", { className: "drssh-fieldLabel", style: { padding: "12px 0 4px", fontWeight: 500 } }, T.setPasswordTitle),
        rows.map((p) => {
          const pwSet = p.auth.type === "password" ? !!(p.secrets && p.secrets.passwordSet) : false;
          const ppSet = !!(p.auth.passphraseRef && p.secrets && p.secrets.passphraseSet);
          const pwTyping = pw.password.length > 0;
          const ppTyping = pw.passphrase.length > 0;
          const dot = (on) => h("span", { className: "drssh-chip", style: on ? { color: "var(--dsw-alias-state-success-primary,#30a46c)" } : { color: "var(--dsw-alias-label-tertiary,rgba(127,127,127,.8))" } }, on ? T.secretSet + " ✓" : T.secretMissing);
          return h("div", { key: p.id, className: "drssh-fieldRow" },
            h("div", { className: "drssh-row" },
              h("span", { className: "drssh-proMeta drssh-code", style: { width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name),
              p.auth.type === "password" && dot(pwSet),
              p.auth.passphraseRef && dot(ppSet),
              h("span", { className: "drssh-hint drssh-code" }, p.auth.type === "key" ? (p.auth.passphraseRef || "") : (p.auth.passwordRef || ""))
            ),
            h("div", { className: "drssh-row", style: { marginTop: 4 } },
              p.auth.type === "password" && h(Input, {
                type: "password", placeholder: pwSet && !pwTyping ? T.secretPlaceholder : T.passwordPh,
                value: pw.password, onChange: (e) => setPw({ ...pw, password: e.target.value }),
                style: { width: 220 }
              }),
              p.auth.type === "password" && ACT({ label: T.savePassword, onClick: () => saveSecret(p, "password"), disabled: busy === p.id + ":password" || !pw.password }),
              p.auth.passphraseRef && h(Input, {
                type: "password", placeholder: ppSet && !ppTyping ? T.secretPlaceholder : T.passphrasePh,
                value: pw.passphrase, onChange: (e) => setPw({ ...pw, passphrase: e.target.value }),
                style: { width: 220 }
              }),
              p.auth.passphraseRef && ACT({ label: T.savePassphrase, onClick: () => saveSecret(p, "passphrase"), disabled: busy === p.id + ":passphrase" || !pw.passphrase })
            ),
            (pwTyping || ppTyping) && h("div", { className: "drssh-hint", style: { marginTop: 2 } }, T.secretTypeHint)
          );
        })
      );
    }

    function Card(props) {
      const [open, setOpen] = react.useState(!!(props && props.defaultOpen));
      const [state, setState] = react.useState({ loading: false, error: "", data: null });
      const [form, setForm] = react.useState(null);
      const [busy, setBusy] = react.useState("");
      const [pw, setPw] = react.useState({ password: "", passphrase: "" });
      const [note, setNote] = react.useState({ id: null, text: "", ok: false });
      const [dirtyLoaded, setDirtyLoaded] = react.useState(false);
      const gen = react.useRef(0);

      const load = react.useCallback(async () => {
        const id = ++gen.current;
        setState((s) => ({ ...s, loading: true }));
        try { const d = await api("/state"); if (id === gen.current) setState({ loading: false, error: "", data: d.data }); }
        catch (e) { if (id === gen.current) setState({ loading: false, error: String(e.message || e), data: null }); }
      }, []);
      const flash = (text, ok) => { setNote({ id: Date.now(), text, ok }); setTimeout(() => setNote((n) => (n.id === noteId ? { ...n, text: "" } : n)), 0); };
      const noteId = note.id;

      const ensure = () => { if (open && !state.data && !state.loading && !dirtyLoaded) { setDirtyLoaded(true); load(); } };
      react.useEffect(ensure, [open, state.data, state.loading, dirtyLoaded]);

      const saveForm = async () => {
        if (!form) return;
        if (!(form.name || "").trim() || !(form.host || "").trim()) { setNote({ id: Date.now(), text: T.required, ok: false }); return; }
        const body = { name: form.name.trim(), host: form.host.trim(), port: form.port ? Number(form.port) : 22, user: (form.user || "").trim(), group: (form.group || "").trim(), notes: (form.notes || "").trim(), authType: form.authType };
        if (body.authType === "key") body.keyPath = (form.keyPath || "").trim();
        if ((form.passwordRef || "").trim()) body.passwordRef = form.passwordRef.trim();
        if ((form.passphraseRef || "").trim()) body.passphraseRef = form.passphraseRef.trim();
        const refOk = /^[A-Za-z_][A-Za-z0-9_]*$/;
        for (const key of ["passwordRef", "passphraseRef"]) {
          if (body[key] && !refOk.test(body[key])) { setNote({ id: Date.now(), text: T.refRule, ok: false }); return; }
        }
        setBusy("save");
        try {
          if (form.id) await api("/profiles/" + encodeURIComponent(form.id), { method: "PUT", body: JSON.stringify({ profile: body }) });
          else await api("/profiles", { method: "POST", body: JSON.stringify({ profile: body }) });
          setForm(null); await load(); setNote({ id: Date.now(), text: T.save + " ✓", ok: true });
        } catch (e) { setNote({ id: Date.now(), text: String(e.message || e), ok: false }); }
        setBusy("");
      };

      const startEdit = (p) => setForm(p ? { id: p.id, name: p.name, host: p.host, port: String(p.port), user: p.user || "", group: p.group || "", authType: p.auth.type, keyPath: p.auth.keyPath || "", passwordRef: p.auth.passwordRef || "", passphraseRef: p.auth.passphraseRef || "", notes: p.notes || "" } : { ...EMPTY });
            const [confirmDel, setConfirmDel] = react.useState(null);
      const removeProfile = async (p, clear) => {
        setBusy("del");
        setConfirmDel(null);
        try {
          const q = clear ? "?clear=1" : "";
          const r2 = await api("/profiles/" + encodeURIComponent(p.id) + q, { method: "DELETE" });
          const bits = [T.delDone + ": " + p.name];
          if (r2.cleared && r2.cleared.length) bits.push(T.delCleared + " (" + r2.cleared.join(", ") + ")");
          if (r2.skipped && r2.skipped.length) bits.push(T.delSkipped + ": " + r2.skipped.map((s) => s.ref + "(" + s.reason + ")").join(", "));
          setNote({ id: Date.now(), text: bits.join(" · "), ok: true });
          await load();
        } catch (e) { setNote({ id: Date.now(), text: String(e.message || e), ok: false }); }
        setBusy("");
      };
      const testProfile = async (p) => {
        setNote({ id: Date.now(), text: T.testing + "…", ok: null });
        try {
          const out = await api("/profiles/" + encodeURIComponent(p.id) + "/test", { method: "POST", body: JSON.stringify({}) });
          setNote({ id: Date.now(), text: (out.ok ? T.testOk + " · " : "") + out.stdout.trim().split("\n").join(" · ") || (out.ok ? T.testOk : (out.stderr || "")), ok: out.ok });
        } catch (e) { setNote({ id: Date.now(), text: String(e.message || e), ok: false }); }
      };
      const openSession = async (p) => {
        setBusy(p.id);
        try { const r = await api("/sessions", { method: "POST", body: JSON.stringify({ profile: p.id }) }); window.open(r.page.url, "_blank"); }
        catch (e) { setNote({ id: Date.now(), text: String(e.message || e), ok: false }); }
        setBusy("");
      };
      const copyLink = async (p) => {
        try {
          const r = await api("/sessions", { method: "POST", body: JSON.stringify({ profile: p.id }) });
          try { await navigator.clipboard.writeText(r.page.url); setNote({ id: Date.now(), text: T.copied, ok: true }); }
          catch (e) { window.prompt("URL", r.page.url); }
        } catch (e) { setNote({ id: Date.now(), text: String(e.message || e), ok: false }); }
      };
      const saveSecret = async (p, kind) => {
        const value = kind === "password" ? pw.password : pw.passphrase;
        if (!value) return;
        setBusy(p.id + ":" + kind);
        try {
          await api("/profiles/" + encodeURIComponent(p.id) + "/secret", { method: "POST", body: JSON.stringify({ kind, value }) });
          setPw((x) => ({ ...x, [kind]: "" })); await load(); setNote({ id: Date.now(), text: kind + " ✓", ok: true });
        } catch (e) { setNote({ id: Date.now(), text: String(e.message || e), ok: false }); }
        setBusy("");
      };
      const closeSession = async (sid) => { try { await api("/sessions/" + encodeURIComponent(sid), { method: "DELETE" }); await load(); } catch (e) { /* ignore */ } };

      const authName = (p) => p.auth.type === "password" ? T.authPassword : p.auth.type === "key" ? T.authKey : T.authAgent;
      const credState = (p) => p.auth.type === "password" ? (p.secrets.passwordSet ? T.credSet : T.credMissing) : p.auth.type === "key" && p.auth.passphraseRef ? (p.secrets.passphraseSet ? T.credSet : T.credMissing) : "—";

      let body = null;
      if (open) {
        if (state.loading) body = h("div", { className: "drssh-empty" }, "…");
        else if (!state.data) body = h("div", { className: "drssh-empty drssh-err" }, state.error || T.testing);
        else {
          const data = state.data;
          const profiles = data.profiles;
          body = h("div", null,
            note.text && h("div", { className: note.ok === false ? "drssh-err" : note.ok === true ? "drssh-ok" : "drssh-hint", style: { padding: "8px 0 0" } }, note.text),
            confirmDel && h("div", { className: "drssh-panel" },
              h("div", { className: "drssh-fieldLabel" }, T.delAskName + " \"" + confirmDel.name + "\"?"),
              h("div", { className: "drssh-hint", style: { padding: "2px 0 8px" } }, T.delCredHint),
              h("div", { className: "drssh-row" },
                ACT({ label: T.delWithCred, primary: true, danger: true, onClick: () => removeProfile(confirmDel, true), disabled: busy === "del" }),
                ACT({ label: T.delOnly, onClick: () => removeProfile(confirmDel, false), disabled: busy === "del" }),
                ACT({ label: T.delCancel, onClick: () => setConfirmDel(null), disabled: busy === "del" })
              )
            ),
            form && h("div", null, h("div", { className: "drssh-sep" }), h(ProfileForm, { form, setForm: setForm, onSave: saveForm, onCancel: () => setForm(null), busy }), h("div", { className: "drssh-sep" })),
            profiles.length === 0
              ? h("div", { className: "drssh-empty" }, T.empty)
              : h("div", { className: "drssh-list" }, profiles.map((p) => h("div", { key: p.id, className: "drssh-pro" },
                  h("div", { className: "drssh-proMain" },
                    h("div", { className: "drssh-proName" }, p.name + (p.group ? " · " + p.group : "")),
                    h("div", { className: "drssh-proMeta drssh-code" }, (p.user ? p.user + "@" : "") + p.host + ":" + p.port + " · " + authName(p) + " · " + credState(p))
                  ),
                  ACT({ label: T.test, mini: true, onClick: () => testProfile(p), disabled: busy === p.id }),
                  ACT({ label: T.terminal, mini: true, onClick: () => openSession(p), disabled: busy === p.id }),
                  ACT({ label: T.copy, mini: true, onClick: () => copyLink(p) }),
                  ACT({ label: T.edit, mini: true, onClick: () => startEdit(p) }),
                  ACT({ label: T.remove, mini: true, danger: true, onClick: () => setConfirmDel(p) })
                ))),
            profiles.some((p) => p.auth.type === "password" || p.auth.passphraseRef) && h(SecretRows, { profiles, pw, setPw: setPw, busy, saveSecret }),
            h("div", { className: "drssh-sep" }),
            h("div", { className: "drssh-row" },
              h("div", { className: "drssh-proName" }, T.sessions),
              h("span", { className: "drssh-hint" }, data.sessions.length ? data.sessions.length + "" : T.noSessions)
            ),
            data.sessions.length > 0 && h("div", { className: "drssh-list" }, data.sessions.map((s) => h("div", { key: s.id, className: "drssh-pro" },
              h("span", { className: "drssh-dot", style: { background: s.status === "running" ? "var(--dsw-alias-state-success-primary,#30a46c)" : "var(--dsw-alias-label-tertiary,rgba(127,127,127,.8))" } }),
              h("div", { className: "drssh-proMain" },
                h("div", { className: "drssh-proName" }, s.name),
                h("div", { className: "drssh-proMeta drssh-code" }, (s.user ? s.user + "@" : "") + s.host + ":" + s.port + (s.exitCode !== null && s.exitCode !== undefined ? " · exit " + s.exitCode : ""))
              ),
              ACT({ label: T.close, mini: true, danger: true, onClick: () => closeSession(s.id), disabled: s.status !== "running" })
            ))),
            h("div", { className: "drssh-sep" }),
            h("div", { className: "drssh-row" },
              h("div", { className: "drssh-hint drssh-grow" }, T.settingsHint),
              ACT({ label: T.refresh, onClick: load }),
              ACT({ label: T.add, primary: true, onClick: () => startEdit(null) })
            )
          );
        }
      }

      return h("div", { className: "drssh-item" + (open ? " open" : "") },
        h("button", { type: "button", className: "drssh-itemHead", onClick: () => { setOpen(!open); }, "aria-expanded": open },
          h("span", { style: { flex: 1, minWidth: 0, textAlign: "left" } },
            h("div", { className: "drssh-itemTitle" }, T.title),
            h("div", { className: "drssh-itemSub" }, T.desc)
          ),
          CHEVRON(open)
        ),
        open && h("div", { className: "drssh-itemBody" }, body)
      );
    }

    function SectionCard() {
      return h(Card, { defaultOpen: true });
    }
    const inject = ["slots"];
    function apply(ctx) {
      // collapsed card inside the shared Plugins tab
      ctx.slots.inject("settings.plugin.item", () =>
        ctx.slots.register({ name: "settings.plugin.item", id: "dsh-remote-ssh", key: "dsh-remote-ssh", order: 130, inject: () => ({}) }, Card)
      );
      // dedicated full page in the Settings left navigation
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          { name: "settings.section", id: "dsh-remote-ssh", order: 140, label: () => "Remote SSH", inject: () => ({}) },
          SectionCard
        )
      );
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
