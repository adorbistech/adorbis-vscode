import * as vscode from "vscode";
import { AdorbisApi } from "./api";
import { AdorbisStatusBar } from "./statusBar";
import { ToolConfigurator } from "./toolConfigurator";

export class SetupWizardPanel {
  public static currentPanel: SetupWizardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(context: vscode.ExtensionContext, api: AdorbisApi, statusBar: AdorbisStatusBar) {
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (SetupWizardPanel.currentPanel) {
      SetupWizardPanel.currentPanel.panel.reveal(col);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "adorbisSetup",
      "Adorbis AI — Setup",
      col || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    SetupWizardPanel.currentPanel = new SetupWizardPanel(panel, context, api, statusBar);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    private api: AdorbisApi,
    private statusBar: AdorbisStatusBar
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === "validate") {
        const key = (msg.key as string).trim();
        const result = await this.api.validateKey(key);
        if (result.valid && result.data) {
          await vscode.workspace.getConfiguration("adorbis").update(
            "apiKey", key, vscode.ConfigurationTarget.Global
          );
          this.panel.webview.postMessage({
            command: "validated",
            credits: result.data.credits_remaining,
            plan: result.data.plan,
            email: result.data.email ?? ""
          });
          this.statusBar.setBalance(result.data.credits_remaining, result.data.plan);
        } else {
          this.panel.webview.postMessage({ command: "error", message: result.error ?? "Invalid key" });
        }
      }
      if (msg.command === "configTool") {
        const key = this.api.getApiKey();
        if (key) {
          await ToolConfigurator.run(this.context, key, msg.tool as string);
          this.panel.webview.postMessage({ command: "toolConfigured", tool: msg.tool });
        }
      }
      if (msg.command === "openDashboard") {
        vscode.env.openExternal(vscode.Uri.parse("https://ai.adorbistech.com/dashboard"));
      }
      if (msg.command === "getKey") {
        vscode.env.openExternal(vscode.Uri.parse("https://ai.adorbistech.com"));
      }
    }, null, this.disposables);
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Adorbis Setup</title>
<style>
:root{--bg:#07080d;--surf:#0c0f18;--bdr:#1a1f2e;--cyan:#1e9ad6;--cb:#3ec6f0;--pur:#d2bbff;--grn:#4be257;--txt:#e8eaf0;--mut:#6b7280;--err:#f87171;--r:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.6;padding:32px 24px;max-width:680px;margin:0 auto}
.logo-row{display:flex;align-items:center;gap:10px;margin-bottom:32px}
.lm{width:32px;height:32px;background:linear-gradient(135deg,var(--cyan),var(--cb));border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#07080d;flex-shrink:0}
.ln{font-size:20px;font-weight:700}.ln span{color:var(--cb)}
.tag{color:var(--mut);font-size:12px;margin-left:auto;font-family:monospace}
.step{background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);padding:24px;margin-bottom:16px;transition:border-color .2s}
.step.active{border-color:var(--cyan)}.step.done{border-color:var(--grn);opacity:.7}.step.locked{opacity:.4;pointer-events:none}
.sh{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.sn{width:28px;height:28px;border-radius:50%;background:var(--bdr);border:2px solid var(--mut);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.step.active .sn{border-color:var(--cyan);color:var(--cyan)}.step.done .sn{border-color:var(--grn);background:var(--grn);color:#07080d}
.st{font-size:15px;font-weight:600}.ss{color:var(--mut);font-size:12px}
.ir{display:flex;gap:8px}
input{flex:1;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;color:var(--txt);font-family:monospace;font-size:13px;padding:10px 14px;outline:none;transition:border-color .15s}
input:focus{border-color:var(--cyan)}input.err{border-color:var(--err)}
.btn{padding:10px 18px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;white-space:nowrap}
.btn:active{transform:scale(.97)}.btn:disabled{opacity:.4;cursor:not-allowed}
.bp{background:linear-gradient(135deg,var(--cyan),var(--cb));color:#07080d}
.bg2{background:var(--bdr);color:var(--txt)}.bs{padding:7px 12px;font-size:12px}
.msg{margin-top:10px;font-size:12px;padding:8px 12px;border-radius:6px;display:none}
.msg.show{display:block}
.msg.ok{background:rgba(75,226,87,.12);color:var(--grn);border:1px solid rgba(75,226,87,.25)}
.msg.em{background:rgba(248,113,113,.12);color:var(--err);border:1px solid rgba(248,113,113,.25)}
.bc{display:none;background:rgba(30,154,214,.08);border:1px solid rgba(62,198,240,.2);border-radius:8px;padding:14px 18px;margin-top:12px}
.bc.show{display:flex;align-items:center;justify-content:space-between}
.bl{color:var(--mut);font-size:12px}.bv{font-size:22px;font-weight:700;color:var(--cb);font-family:monospace}.bp2{font-size:11px;color:var(--pur);margin-top:2px}
.tg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.tc{background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:14px;cursor:pointer;transition:border-color .15s,background .15s}
.tc:hover{border-color:var(--cyan);background:rgba(30,154,214,.04)}.tc.cfg{border-color:var(--grn)}
.tn{font-weight:600;font-size:13px;margin-bottom:3px}.td{color:var(--mut);font-size:11px}
.tb{display:inline-block;margin-top:6px;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;font-family:monospace}
.toi{background:rgba(62,198,240,.15);color:var(--cb)}.tan{background:rgba(210,187,255,.15);color:var(--pur)}.tok{background:rgba(75,226,87,.15);color:var(--grn)}
.sp{display:inline-block;width:14px;height:14px;border:2px solid rgba(62,198,240,.3);border-top-color:var(--cb);border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
.fl{color:var(--cyan);cursor:pointer;font-size:12px}.fl:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="logo-row">
  <div class="lm">A</div>
  <div class="ln">Adorbis <span>AI</span></div>
  <div class="tag">One Key. Every Model.</div>
</div>
<div class="step active" id="s1">
  <div class="sh">
    <div class="sn" id="n1">1</div>
    <div><div class="st">Connect your API key</div><div class="ss">Stored in VS Code settings — only sent to api.adorbistech.com</div></div>
  </div>
  <div class="ir">
    <input type="password" id="ki" placeholder="adorbis_xxxxxxxxxxxx" autocomplete="off"/>
    <button class="btn bp" id="vb" onclick="go()">Connect</button>
  </div>
  <div id="km" class="msg"></div>
  <div class="bc" id="bc">
    <div>
      <div class="bl">Credits remaining</div>
      <div class="bv" id="bv">--</div>
      <div class="bp2" id="bpl"></div>
    </div>
    <button class="btn bg2 bs" onclick="dash()">Open Dashboard</button>
  </div>
  <div style="margin-top:14px;font-size:12px;color:var(--mut)">
    No key? <span class="fl" onclick="getk()">Get one free at ai.adorbistech.com</span>
  </div>
</div>
<div class="step locked" id="s2">
  <div class="sh">
    <div class="sn" id="n2">2</div>
    <div><div class="st">Configure your AI coding tool</div><div class="ss">Click your tool — config written automatically</div></div>
  </div>
  <div class="tg">
    <div class="tc" id="t-cline" onclick="ct('cline')"><div class="tn">Cline</div><div class="td">VS Code AI agent</div><span class="tb toi">OpenAI compat</span></div>
    <div class="tc" id="t-continue" onclick="ct('continue')"><div class="tn">Continue</div><div class="td">Open-source assistant</div><span class="tb toi">OpenAI compat</span></div>
    <div class="tc" id="t-claude-code" onclick="ct('claude-code')"><div class="tn">Claude Code</div><div class="td">Anthropic agentic CLI</div><span class="tb tan">Anthropic compat</span></div>
    <div class="tc" id="t-aider" onclick="ct('aider')"><div class="tn">Aider</div><div class="td">Terminal pair programmer</div><span class="tb toi">OpenAI compat</span></div>
    <div class="tc" id="t-roo" onclick="ct('roo')"><div class="tn">Roo Code</div><div class="td">Cline fork</div><span class="tb tan">Anthropic compat</span></div>
    <div class="tc" id="t-opencode" onclick="ct('opencode')"><div class="tn">OpenCode</div><div class="td">SST coding agent</div><span class="tb tan">Anthropic compat</span></div>
  </div>
  <div id="tm" class="msg" style="margin-top:12px"></div>
</div>
<div class="step locked" id="s3">
  <div class="sh">
    <div class="sn" id="n3">3</div>
    <div><div class="st">You are set up</div><div class="ss">Balance updates live in the VS Code status bar</div></div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn bp bs" onclick="dash()">Open Dashboard</button>
    <button class="btn bg2 bs" onclick="more()">Configure more tools</button>
  </div>
</div>
<script>
const vsc = acquireVsCodeApi();
function go() {
  const k = document.getElementById('ki').value.trim();
  if (!k) return;
  const b = document.getElementById('vb');
  b.disabled = true;
  b.innerHTML = '<span class="sp"></span>Connecting...';
  sm('km','','');
  vsc.postMessage({ command: 'validate', key: k });
}
function ct(t) { vsc.postMessage({ command: 'configTool', tool: t }); }
function dash() { vsc.postMessage({ command: 'openDashboard' }); }
function getk() { vsc.postMessage({ command: 'getKey' }); }
function more() { document.getElementById('s2').scrollIntoView({ behavior: 'smooth' }); }
function sm(id, type, text) {
  const e = document.getElementById(id);
  e.className = 'msg' + (type ? ' ' + type + ' show' : '');
  e.textContent = text;
}
window.addEventListener('message', e => {
  const m = e.data;
  if (m.command === 'validated') {
    const b = document.getElementById('vb');
    b.disabled = false;
    b.textContent = 'Connected';
    b.style.background = 'linear-gradient(135deg,#4be257,#2dd44a)';
    document.getElementById('bv').textContent = m.credits >= 1000
      ? (m.credits/1000).toFixed(1) + 'K AC' : m.credits + ' AC';
    document.getElementById('bpl').textContent = m.plan.charAt(0).toUpperCase()
      + m.plan.slice(1) + ' plan' + (m.email ? ' - ' + m.email : '');
    document.getElementById('bc').classList.add('show');
    sm('km','ok','API key connected successfully');
    document.getElementById('s1').className = 'step done';
    document.getElementById('n1').textContent = 'v';
    document.getElementById('s2').className = 'step active';
  }
  if (m.command === 'error') {
    const b = document.getElementById('vb');
    b.disabled = false;
    b.textContent = 'Connect';
    document.getElementById('ki').classList.add('err');
    sm('km','em','Error: ' + m.message);
  }
  if (m.command === 'toolConfigured') {
    const c = document.getElementById('t-' + m.tool);
    if (c) {
      c.classList.add('cfg');
      const tb = c.querySelector('.tb');
      tb.className = 'tb tok';
      tb.textContent = 'configured';
    }
    sm('tm','ok','Config written. Restart your tool to pick up changes.');
    document.getElementById('s2').className = 'step done';
    document.getElementById('n2').textContent = 'v';
    document.getElementById('s3').className = 'step active';
  }
});
document.getElementById('ki').addEventListener('keydown', e => {
  if (e.key === 'Enter') go();
  document.getElementById('ki').classList.remove('err');
});
</script>
</body>
</html>`;
  }

  dispose() {
    SetupWizardPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
