import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const BASE = "https://api.adorbistech.com";
const API = `${BASE}/v1`;

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function mergeVSCode(additions: Record<string, string>) {
  const p = path.join(os.homedir(), ".vscode", "settings.json");
  ensureDir(path.dirname(p));
  let existing: Record<string, any> = {};
  if (fs.existsSync(p)) { try { existing = JSON.parse(fs.readFileSync(p, "utf8")); } catch {} }
  fs.writeFileSync(p, JSON.stringify({ ...existing, ...additions }, null, 2), "utf8");
}

const TOOLS: Record<string, { name: string; write: (k: string, d: string) => void; hint: string }> = {
  cline: {
    name: "Cline",
    write: (k, d) => mergeVSCode({ "cline.apiProvider": "openai-native", "cline.openAiApiKey": k, "cline.openAiBaseUrl": API, "cline.openAiModelId": d }),
    hint: "Restart VS Code or reload the window.",
  },
  continue: {
    name: "Continue",
    write: (k, d) => {
      const p = path.join(os.homedir(), ".continue", "config.json");
      ensureDir(path.dirname(p));
      let cfg: any = {};
      if (fs.existsSync(p)) { try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch {} }
      if (!cfg.models) cfg.models = [];
      const idx = cfg.models.findIndex((m: any) => m.title === "Adorbis AI");
      const entry = { title: "Adorbis AI", provider: "openai", model: d, apiKey: k, apiBase: API };
      if (idx >= 0) cfg.models[idx] = entry; else cfg.models.unshift(entry);
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf8");
    },
    hint: "Restart Continue to pick up the new model.",
  },
  "claude-code": {
    name: "Claude Code",
    write: (k) => {
      const p = path.join(os.homedir(), ".claude", "settings.json");
      ensureDir(path.dirname(p));
      let cfg: any = {};
      if (fs.existsSync(p)) { try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch {} }
      cfg.ANTHROPIC_BASE_URL = BASE;
      cfg.ANTHROPIC_API_KEY = k;
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf8");
    },
    hint: "Written to ~/.claude/settings.json.",
  },
  aider: {
    name: "Aider",
    write: (k, d) => {
      fs.writeFileSync(path.join(os.homedir(), ".aider.conf.yml"),
        `# Adorbis AI\nopenai-api-key: ${k}\nopenai-api-base: ${API}\nmodel: ${d}\n`, "utf8");
    },
    hint: "Run aider from any directory.",
  },
  roo: {
    name: "Roo Code",
    write: (k) => mergeVSCode({ "roo-cline.apiProvider": "anthropic", "roo-cline.anthropicApiKey": k, "roo-cline.anthropicBaseUrl": BASE }),
    hint: "Reload the VS Code window.",
  },
  opencode: {
    name: "OpenCode",
    write: (k) => {
      const p = path.join(os.homedir(), ".config", "opencode", "config.json");
      ensureDir(path.dirname(p));
      fs.writeFileSync(p, JSON.stringify({ provider: "anthropic", model: "claude-sonnet-4-6", anthropic: { apiKey: k, baseURL: `${BASE}/v1` } }, null, 2), "utf8");
    },
    hint: "Written to ~/.config/opencode/config.json.",
  },
};

export class ToolConfigurator {
  static async run(context: vscode.ExtensionContext, key: string, preselected?: string) {
    const dept = vscode.workspace.getConfiguration("adorbis").get<string>("defaultDepartment", "adorbis/coder");
    let toolId = preselected;
    if (!toolId) {
      const picks = Object.entries(TOOLS).map(([id, t]) => ({ label: t.name, id }));
      const choice = await vscode.window.showQuickPick(picks, { placeHolder: "Which AI tool to configure?" });
      if (!choice) return;
      toolId = choice.id;
    }
    const tool = TOOLS[toolId];
    if (!tool) return;
    try {
      tool.write(key, dept);
      vscode.window.showInformationMessage(`Adorbis: ${tool.name} configured. ${tool.hint}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Adorbis: Failed to configure ${tool.name} — ${err.message}`);
    }
  }
}
