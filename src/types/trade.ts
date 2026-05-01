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

/** Eine Zeile aus `user_position_transactions` (Dual-Write), für Anzeige / spätere Bearbeitung. */
export type TradePositionBookingKind = "BUY" | "SELL" | "TAX_CORRECTION" | "INCOME";

export interface TradePositionBooking {
  transactionId: string;
  kind: TradePositionBookingKind;
  /** ISO-Zeitstempel für Speichern / datetime-local (aus DB oder synthetisch). */
  bookedAtIso: string;
  /** Anzeigezeit wie im restlichen Dashboard (`formatDateTimeAT`). */
  bookedAtDisplay: string;
  qty?: number;
  unitPrice?: number;
  grossAmount: number;
  feesAmount: number;
  taxAmount: number;
  /** DB: BUY, BUY_2, SELL, SELL_2, TAX_CORRECTION, INCOME, … */
  legacyLeg?: string;
}

export interface Trade {
  id: string;
  sourceBroker?: "TRADE_REPUBLIC" | "N26" | "BAWAG" | "MANUAL";
  sourceAccount?: string;
  externalEventId?: string;
  name: string;
  typ: TradeType | string;
  basiswert: string;
  isin?: string;
  wkn?: string;
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
  verkaufPreisManuell?: number;
  gewinn?: number;
  status: TradeStatus;
  /** Optional: aus Supabase geladen (`user_position_transactions`). */
  bookings?: TradePositionBooking[];
}
