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
  kaufPreis: string;
  stueck: string;
  status: Trade["status"];
  verkaufszeitpunkt: string;
  verkaufPreis: string;
}

export function defaultForm(): NewTradeForm {
  return {
    name: "",
    typ: "Long",
    basiswert: "",
    notiz: "",
    kaufzeitpunkt: "",
    kaufPreis: "",
    stueck: "",
    status: "Offen",
    verkaufszeitpunkt: "",
    verkaufPreis: ""
  };
}
