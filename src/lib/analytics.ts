import type { Trade, TradePositionBooking } from "../types/trade";

const CASHFLOW_TYPES = new Set<string>(["Steuerkorrektur", "Dividende", "Zinszahlung"]);

const QTY_EPS = 1e-6;

function sumBookingQty(bookings: TradePositionBooking[] | undefined, kind: TradePositionBooking["kind"]): number {
  if (!bookings?.length) return 0;
  return bookings.filter((b) => b.kind === kind).reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
}

/** Gesamt gekaufte Stückzahl (BUY-Summe oder Positionsgröße / Rest+Verkauft). */
export function getTradeBoughtQty(trade: Trade): number {
  if (CASHFLOW_TYPES.has(String(trade.typ))) return 0;
  const buy = sumBookingQty(trade.bookings, "BUY");
  if (buy > 0) return buy;
  const sell = sumBookingQty(trade.bookings, "SELL");
  const st = trade.stueck ?? 0;
  if (sell > 0 && st > 0) return st + sell;
  return st;
}

/** Verkaufte Stückzahl (SELL-Summe; ohne Buchungen: bei geschlossenem Trade = Positionsgröße). */
export function getTradeSoldQty(trade: Trade): number {
  if (CASHFLOW_TYPES.has(String(trade.typ))) return 0;
  const sell = sumBookingQty(trade.bookings, "SELL");
  if (sell > 0) return sell;
  const buy = sumBookingQty(trade.bookings, "BUY");
  const st = trade.stueck ?? 0;
  if (buy === 0 && st > 0 && (trade.verkaufszeitpunkt || trade.status === "Geschlossen")) {
    return st;
  }
  return 0;
}

let moneyLocale = "de-AT";
let moneyCurrency = "EUR";

export function setMoneyFormat(locale: string, currency: string) {
  moneyLocale = locale;
  moneyCurrency = currency;
}

export function money(value: number | null | undefined): string {
  const n = Number(value);
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(moneyLocale, {
    style: "currency",
    currency: moneyCurrency
  }).format(v);
}

export function getKpis(trades: Trade[]) {
  const open = trades.filter((t) => !isTradeClosed(t));
  const closed = trades.filter((t) => isTradeClosed(t));
  const totalPL = closed.reduce((sum, t) => sum + getTradeRealizedPL(t), 0);
  const openCapital = open.reduce((sum, t) => sum + (t.kaufPreis ?? 0), 0);
  const wins = closed.filter((t) => getTradeRealizedPL(t) > 0).length;
  const losses = closed.filter((t) => getTradeRealizedPL(t) < 0).length;

  return {
    totalTrades: trades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    totalPL,
    openCapital,
    wins,
    losses
  };
}

export function topAssets(trades: Trade[]) {
  const map = new Map<string, number>();
  trades
    .filter((t) => isTradeClosed(t))
    .forEach((t) => map.set(t.basiswert, (map.get(t.basiswert) ?? 0) + getTradeRealizedPL(t)));

  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function isTradeClosed(trade: Trade): boolean {
  if (CASHFLOW_TYPES.has(String(trade.typ))) {
    if (trade.status === "Geschlossen") return true;
    if (trade.verkaufszeitpunkt) return true;
    if ((trade.gewinn ?? 0) !== 0) return true;
    if ((trade.verkaufPreis ?? 0) !== 0) return true;
    return false;
  }

  const bought = getTradeBoughtQty(trade);
  const sold = getTradeSoldQty(trade);
  if (bought > 0) {
    if (sold + QTY_EPS < bought) return false;
    if (sold + QTY_EPS >= bought) return true;
  }

  if (trade.status === "Geschlossen") return true;
  if (trade.verkaufszeitpunkt) return true;
  if ((trade.gewinn ?? 0) !== 0) return true;
  if ((trade.verkaufPreis ?? 0) !== 0) return true;
  return false;
}

export function getTradeRealizedPL(trade: Trade): number {
  if (!isTradeClosed(trade)) return 0;

  const kauf = trade.kaufPreis ?? 0;
  const verkauf = trade.verkaufPreis;

  /** Wenn ein Verkaufspreis vorliegt, ist das der maßgebliche Cashflow (Kauf/Verkauf nicht mit Gewinn-Spalte verwechseln). */
  if (verkauf !== undefined && Number.isFinite(verkauf)) {
    return verkauf - kauf;
  }

  const g = trade.gewinn;
  if (g !== undefined && Number.isFinite(g)) {
    return g;
  }

  return 0;
}
