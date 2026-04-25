import type { AppSettings } from "./settings";

type Lang = AppSettings["language"];
type Dict = Record<string, string>;

const de: Dict = {
  navDashboard: "Dashboard",
  navTrades: "Trades",
  navAssets: "Basiswerte",
  navAnalytics: "Auswertungen",
  navSettings: "Einstellungen",
  themeLight: "Light Modus",
  themeDark: "Dark Modus",
  marketOpen: "Börse offen",
  marketClosed: "Börse geschlossen",
  dateTime: "Datum & Uhrzeit",
  marketStatusPulse: "Börsenstatus-Pulse anzeigen",
  reset: "Reset"
};

const en: Dict = {
  navDashboard: "Dashboard",
  navTrades: "Trades",
  navAssets: "Assets",
  navAnalytics: "Analytics",
  navSettings: "Settings",
  themeLight: "Light mode",
  themeDark: "Dark mode",
  marketOpen: "Market open",
  marketClosed: "Market closed",
  dateTime: "Date & time",
  marketStatusPulse: "Show market status pulse",
  reset: "Reset"
};

const byLang: Record<Lang, Dict> = { de, en };

export function t(lang: Lang, key: keyof typeof de): string {
  return byLang[lang][key] ?? de[key] ?? key;
}
