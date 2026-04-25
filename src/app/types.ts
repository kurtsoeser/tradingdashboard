import type { Trade } from "../types/trade";

export type View = "dashboard" | "trades" | "newTrade" | "assets" | "analytics" | "settings";
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
  tickerUs?: string;
  tickerXetra?: string;
  waehrung?: string;
}

export interface AssetDisplayRow extends AssetRow {
  tickerUs?: string;
  tickerXetra?: string;
  waehrung?: string;
}

export interface NewTradeForm {
  name: string;
  typ: TradeFormType;
  basiswert: string;
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
}

export function defaultForm(overrides?: Partial<NewTradeForm>): NewTradeForm {
  return {
    name: "",
    typ: "Long",
    basiswert: "",
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
    ...overrides
  };
}
