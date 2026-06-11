import * as vscode from "vscode";

const BASE_URL = "https://api.adorbistech.com";

export interface BalanceResult {
  credits_remaining: number;
  plan: string;
  email?: string;
}

export class AdorbisApi {
  constructor(private context: vscode.ExtensionContext) {}

  getApiKey(): string {
    return vscode.workspace.getConfiguration("adorbis").get<string>("apiKey", "").trim();
  }

  async validateKey(key: string): Promise<{ valid: boolean; data?: BalanceResult; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      });
      if (res.status === 401 || res.status === 403) return { valid: false, error: "Invalid API key." };
      if (!res.ok) return { valid: false, error: `Server error (${res.status})` };
      const data = await res.json() as any;
      return {
        valid: true,
        data: {
          credits_remaining: data.credits_remaining ?? data.balance ?? data.credits ?? 0,
          plan: data.plan ?? data.tier ?? "free",
          email: data.email,
        },
      };
    } catch (err: any) {
      return { valid: false, error: `Network error: ${err.message}` };
    }
  }

  async getBalance(): Promise<BalanceResult | null> {
    const key = this.getApiKey();
    if (!key) return null;
    const result = await this.validateKey(key);
    return result.valid ? (result.data ?? null) : null;
  }
}
