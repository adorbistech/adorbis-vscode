import * as vscode from "vscode";
import { AdorbisApi } from "./api";

export class AdorbisStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private refreshing = false;

  constructor(private context: vscode.ExtensionContext, private api: AdorbisApi) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "adorbis.checkBalance";
    this.item.tooltip = "Adorbis AI — click to refresh balance";
    this.setLoading();
    this.item.show();
    context.subscriptions.push(this.item);
  }

  setLoading() { this.item.text = "$(loading~spin) Adorbis"; this.item.backgroundColor = undefined; }

  setUnauthenticated() {
    this.item.text = "$(key) Adorbis: Setup";
    this.item.tooltip = "Click to connect your Adorbis API key";
    this.item.command = "adorbis.setup";
    this.item.backgroundColor = undefined;
  }

  setBalance(credits: number, plan: string) {
    const fmt = credits >= 1000 ? `${(credits/1000).toFixed(1)}K` : `${credits}`;
    const icon = plan === "free" ? "$(person)" : "$(verified)";
    this.item.text = `${icon} Adorbis ${fmt} AC`;
    this.item.tooltip = `Adorbis AI — ${credits.toLocaleString()} credits remaining (${plan})\nClick to refresh`;
    this.item.command = "adorbis.checkBalance";
    this.item.backgroundColor = credits < 200
      ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
  }

  setError(msg: string) {
    this.item.text = "$(warning) Adorbis";
    this.item.tooltip = `Adorbis: ${msg}`;
    this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  }

  async refresh(showNotification = false) {
    if (this.refreshing) return;
    this.refreshing = true;
    const key = this.api.getApiKey();
    if (!key) { this.setUnauthenticated(); this.refreshing = false; return; }
    this.setLoading();
    try {
      const balance = await this.api.getBalance();
      if (!balance) {
        this.setError("Key invalid or unreachable");
        if (showNotification) vscode.window.showErrorMessage("Adorbis: Could not fetch balance. Check your API key.");
      } else {
        this.setBalance(balance.credits_remaining, balance.plan);
        if (showNotification) vscode.window.showInformationMessage(`Adorbis: ${balance.credits_remaining.toLocaleString()} credits remaining (${balance.plan})`);
      }
    } catch { this.setError("Network error"); }
    finally { this.refreshing = false; }
  }

  dispose() { this.item.dispose(); }
}
