export type TradeType =
  | "Long"
  | "Short"
  | "Aktie"
  | "Anleihe"
  | "Fond"
  | "Derivat"
  | "Dividende"
  | "Zinszahlung"
  | "Steuerkorrektur";

export type TradeStatus = "Offen" | "Geschlossen";

export interface Trade {
  id: string;
  name: string;
  typ: TradeType | string;
  basiswert: string;
  notiz?: string;
  kaufzeitpunkt: string;
  kaufPreis: number;
  stueck?: number;
  verkaufszeitpunkt?: string;
  verkaufPreis?: number;
  gewinn?: number;
  status: TradeStatus;
}
