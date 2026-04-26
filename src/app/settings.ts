export type StartView = "dashboard" | "trades" | "assets" | "analytics" | "journal";

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
  financeService: "google"
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
