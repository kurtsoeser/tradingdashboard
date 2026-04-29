export type StartView = "dashboard" | "trades" | "assets" | "analytics" | "journal";

/** „off“ = kein API-Aufruf aus der App. */
export type AiProvider = "off" | "google" | "anthropic" | "openai";

export type TraderProviderId = "trade-republic" | "onvista";

export interface AppSettings {
  currency: "EUR" | "USD" | "CHF" | "GBP";
  timezone: "Europe/Vienna" | "Europe/Berlin" | "UTC" | "America/New_York";
  exchange: "XETRA" | "NYSE" | "NASDAQ" | "LSE";
  language: "de" | "en";
  dateFormat: "dd.MM.yyyy" | "yyyy-MM-dd";
  numberFormat: "de-DE" | "en-US";
  defaultStartView: StartView;
  compactMode: boolean;
  confirmBeforeDelete: boolean;
  showMarketPulse: boolean;
  defaultBuyFees: number;
  defaultSellFees: number;
  weekStartsOn: "monday" | "sunday";
  financeService: "google" | "yahoo" | "tradingview" | "investing";
  /** KI-Chat: Anbieter, Modell, optional API-Key und optional Proxy-URL (empfohlen für Anthropic/OpenAI im Browser). */
  aiProvider: AiProvider;
  aiModel: string;
  aiApiKey: string;
  aiBackendUrl: string;
  /**
   * Nur Google Gemini: „Grounding mit Google Suche“ für jede Chat-Anfrage (zusätzliche API-Kosten).
   * Der Schnellprompt „Markt-Briefing (Live)“ aktiviert Websuche außerdem einmalig für den nächsten Send,
   * unabhängig von dieser Option — sofern direkter Gemini-Aufruf oder ein Proxy das Feld durchreicht.
   */
  aiGeminiGoogleSearchGrounding: boolean;

  /**
   * Externe Broker/Trader, die beim „Extern“-Symbol in Trades/Basiswerten verlinkt werden.
   * (Ohne Login-Automation; nur Suche/Portal-Links.)
   */
  traderProviders: TraderProviderId[];
}

export const defaultAppSettings: AppSettings = {
  currency: "EUR",
  timezone: "Europe/Vienna",
  exchange: "XETRA",
  language: "de",
  dateFormat: "dd.MM.yyyy",
  numberFormat: "de-DE",
  defaultStartView: "dashboard",
  compactMode: false,
  confirmBeforeDelete: true,
  showMarketPulse: true,
  defaultBuyFees: 1,
  defaultSellFees: 1,
  weekStartsOn: "monday",
  financeService: "google",
  aiProvider: "off",
  aiModel: "gemini-1.5-flash",
  aiApiKey: "",
  aiBackendUrl: "",
  aiGeminiGoogleSearchGrounding: false,

  traderProviders: ["trade-republic"]
};

export function readStoredAppSettings(): AppSettings {
  const saved = window.localStorage.getItem("app-settings");
  if (!saved) return defaultAppSettings;
  try {
    return { ...defaultAppSettings, ...(JSON.parse(saved) as Partial<AppSettings>) };
  } catch {
    return defaultAppSettings;
  }
}

export function getLanguageLocale(language: AppSettings["language"]): string {
  return language === "en" ? "en-US" : "de-AT";
}
