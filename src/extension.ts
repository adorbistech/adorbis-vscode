import * as vscode from "vscode";
import { AdorbisStatusBar } from "./statusBar";
import { SetupWizardPanel } from "./setupWizard";
import { ToolConfigurator } from "./toolConfigurator";
import { AdorbisApi } from "./api";

let statusBar: AdorbisStatusBar;

export function activate(context: vscode.ExtensionContext) {
  const api = new AdorbisApi(context);
  statusBar = new AdorbisStatusBar(context, api);

  context.subscriptions.push(
    vscode.commands.registerCommand("adorbis.setup", () => SetupWizardPanel.createOrShow(context, api, statusBar)),
    vscode.commands.registerCommand("adorbis.checkBalance", async () => {
      if (!api.getApiKey()) {
        const a = await vscode.window.showWarningMessage("No Adorbis API key found.", "Run Setup");
        if (a === "Run Setup") vscode.commands.executeCommand("adorbis.setup");
        return;
      }
      await statusBar.refresh(true);
    }),
    vscode.commands.registerCommand("adorbis.configTool", async () => {
      const key = api.getApiKey();
      if (!key) { vscode.commands.executeCommand("adorbis.setup"); return; }
      await ToolConfigurator.run(context, key);
    }),
    vscode.commands.registerCommand("adorbis.openDashboard", () =>
      vscode.env.openExternal(vscode.Uri.parse("https://ai.adorbistech.com/dashboard"))),
    vscode.commands.registerCommand("adorbis.logout", async () => {
      const c = await vscode.window.showWarningMessage("Remove your Adorbis API key?", { modal: true }, "Remove");
      if (c === "Remove") {
        await vscode.workspace.getConfiguration("adorbis").update("apiKey", "", vscode.ConfigurationTarget.Global);
        statusBar.setUnauthenticated();
        vscode.window.showInformationMessage("Adorbis: signed out.");
      }
    })
  );

  const t = setInterval(() => statusBar.refresh(), 5 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(t) });

  if (!api.getApiKey()) {
    vscode.window.showInformationMessage("Welcome to Adorbis AI — one key, every model.", "Connect API Key")
      .then(a => { if (a === "Connect API Key") vscode.commands.executeCommand("adorbis.setup"); });
  } else {
    statusBar.refresh();
  }
}

export function deactivate() { statusBar?.dispose(); }
