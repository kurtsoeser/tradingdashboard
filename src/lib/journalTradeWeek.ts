import { parseStoredDateTime } from "../app/date";
import type { Trade } from "../types/trade";
import { getIsoWeekYearAndWeek, toLocalYmd } from "./journalIsoWeek";

export function dateInIsoWeek(d: Date, isoYear: number, week: number): boolean {
  const { isoYear: y, week: w } = getIsoWeekYearAndWeek(d);
  return y === isoYear && w === week;
}

/** Trade zählt zur KW, wenn Kauf- oder Verkaufszeitpunkt (Datum) in dieser ISO-KW liegt. */
export function tradeTouchesIsoWeek(trade: Trade, isoYear: number, week: number): boolean {
  const kauf = parseStoredDateTime(trade.kaufzeitpunkt);
  if (kauf && dateInIsoWeek(kauf, isoYear, week)) return true;
  const verkauf = parseStoredDateTime(trade.verkaufszeitpunkt);
  if (verkauf && dateInIsoWeek(verkauf, isoYear, week)) return true;
  return false;
}

export function filterTradesByIsoWeek(trades: Trade[], isoYear: number, week: number): Trade[] {
  return trades.filter((t) => tradeTouchesIsoWeek(t, isoYear, week));
}

export function sortTradesByKaufDesc(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const ta = parseStoredDateTime(a.kaufzeitpunkt)?.getTime() ?? 0;
    const tb = parseStoredDateTime(b.kaufzeitpunkt)?.getTime() ?? 0;
    return tb - ta;
  });
}

/** Kalendertag lokal (YYYY-MM-DD) für Kauf- oder Verkaufszeitpunkt */
export function tradeTouchesLocalYmd(trade: Trade, ymd: string): boolean {
  const kauf = parseStoredDateTime(trade.kaufzeitpunkt);
  if (kauf && toLocalYmd(kauf) === ymd) return true;
  const verkauf = parseStoredDateTime(trade.verkaufszeitpunkt);
  if (verkauf && toLocalYmd(verkauf) === ymd) return true;
  return false;
}

export function filterTradesByLocalYmd(trades: Trade[], ymd: string): Trade[] {
  return trades.filter((t) => tradeTouchesLocalYmd(t, ymd));
}

/** Kalendermonat lokal (YYYY-MM) für Kauf- oder Verkaufszeitpunkt */
export function tradeTouchesLocalYm(trade: Trade, ym: string): boolean {
  const kauf = parseStoredDateTime(trade.kaufzeitpunkt);
  if (kauf && toLocalYmd(kauf).slice(0, 7) === ym) return true;
  const verkauf = parseStoredDateTime(trade.verkaufszeitpunkt);
  if (verkauf && toLocalYmd(verkauf).slice(0, 7) === ym) return true;
  return false;
}

export function filterTradesByLocalYm(trades: Trade[], ym: string): Trade[] {
  return trades.filter((t) => tradeTouchesLocalYm(t, ym));
}
