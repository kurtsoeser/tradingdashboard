import type { Trade } from "../types/trade";

export type View =
  | "dashboard"
  | "trades"
  | "newTrade"
  | "assets"
  | "analytics"
  | "journal"
  | "aiAssistant"
  | "aiAssistantPlan"
  | "isinLive"
  | "settings";
export type TradeFormType = Trade["typ"];
export type TradesSortField = "kauf" | "verkauf" | "name" | "typ" | "kaufPreis" | "verkaufPreis" | "gewinn";
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
  stueck: string;
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
    ...overrides
  };
}
