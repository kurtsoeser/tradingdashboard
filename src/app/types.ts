import type { Trade, TradeStatus } from "../types/trade";

export type View =
  | "dashboard"
  | "trades"
  | "import"
  | "bookings"
  | "newTrade"
  | "assets"
  | "analytics"
  | "journal"
  | "aiAssistant"
  | "aiAssistantPlan"
  | "isinLive"
  | "settings";
export type TradeFormType = Trade["typ"];
export type TradesSortField = "kauf" | "verkauf" | "name" | "typ" | "kaufPreis" | "verkaufPreis" | "gewinn" | "rendite";
export type DashboardOpenSortField = "name" | "typ" | "basiswert" | "kaufzeitpunkt" | "kaufPreis" | "stueck";
export type SortDirection = "asc" | "desc";
export type AssetSortField = "name" | "category" | "tradesCount" | "realizedPL" | "openCapital";

export interface AssetRow {
  name: string;
  category: string;
  tradesCount: number;
  realizedPL: number;
  openCapital: number;
  hasOpen: boolean;
}

export interface AssetMeta {
  name: string;
  category?: string;
  /** Ein Ticker: Kürzel (z. B. SAP) oder voll mit Börse (z. B. NYSE:JPM, NASDAQ:AAPL). */
  ticker?: string;
  isin?: string;
  wkn?: string;
  waehrung?: string;
}

export interface AssetDisplayRow extends AssetRow {
  ticker?: string;
  waehrung?: string;
}

export interface NewTradeForm {
  name: string;
  typ: TradeFormType;
  basiswert: string;
  isin: string;
  wkn: string;
  notiz: string;
  kaufzeitpunkt: string;
  /** Stückzahl Kauf (Kaufdaten-Kachel). */
  stueck: string;
  /** Stückzahl Verkauf (Verkaufsdaten-Kachel); bei Bearbeitung mit Buchungen = Summe SELL-Mengen. */
  stueckVerkauf: string;
  kaufStueckpreis: string;
  kaufTransaktionManuell: string;
  kaufGebuehren: string;
  kaufPreisManuell: string;
  verkaufszeitpunkt: string;
  verkaufStueckpreis: string;
  verkaufTransaktionManuell: string;
  verkaufSteuern: string;
  verkaufGebuehren: string;
  verkaufPreisManuell: string;
  /** Nur normale Trades (nicht Dividende/Zins/Steuerkorrektur): explizit offen oder geschlossen. */
  tradeStatus: TradeStatus;
}

export function defaultForm(overrides?: Partial<NewTradeForm>): NewTradeForm {
  return {
    name: "",
    typ: "Long",
    basiswert: "",
    isin: "",
    wkn: "",
    notiz: "",
    kaufzeitpunkt: "",
    stueck: "",
    stueckVerkauf: "",
    kaufStueckpreis: "",
    kaufTransaktionManuell: "",
    kaufGebuehren: "",
    kaufPreisManuell: "",
    verkaufszeitpunkt: "",
    verkaufStueckpreis: "",
    verkaufTransaktionManuell: "",
    verkaufSteuern: "",
    verkaufGebuehren: "",
    verkaufPreisManuell: "",
    tradeStatus: "Offen",
    ...overrides
  };
}
