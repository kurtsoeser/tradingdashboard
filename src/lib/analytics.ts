import type { Trade } from "../types/trade";

export function money(value: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR"
  }).format(value);
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
