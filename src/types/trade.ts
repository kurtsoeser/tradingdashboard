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
  kaufStueckpreis?: number;
  kaufTransaktionManuell?: number;
  kaufGebuehren?: number;
  kaufPreisManuell?: number;
  verkaufszeitpunkt?: string;
  verkaufPreis?: number;
  verkaufStueckpreis?: number;
  verkaufTransaktionManuell?: number;
  verkaufSteuern?: number;
  verkaufGebuehren?: number;
  gewinn?: number;
  status: TradeStatus;
}
