import type { AssetMeta } from "../app/types";
import type { Trade } from "../types/trade";
import { KNOWN_TICKER_SUGGESTIONS, lookupKnownTickerSuggestion } from "../data/knownAssetTickers";
import { assetToTradingViewSymbol } from "./tradingViewSymbol";

function uniqueBasiswerteInOrder(trades: Trade[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of trades) {
    const name = t.basiswert?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function toDisplayRow(row: AssetMeta) {
  return {
    name: row.name,
    category: row.category ?? "",
    tradesCount: 0,
    realizedPL: 0,
    openCapital: 0,
    hasOpen: false,
    ticker: row.ticker,
    waehrung: row.waehrung
  };
}

function canResolveChartSymbol(row: AssetMeta): boolean {
  return assetToTradingViewSymbol(toDisplayRow(row)) !== null;
}

export function enrichAssetMetaFromKnownTickers(trades: Trade[], assetMeta: AssetMeta[]): {
  nextMeta: AssetMeta[];
  applied: string[];
  stillWithoutChartSymbol: string[];
} {
  const byLower = new Map<string, AssetMeta>();
  for (const row of assetMeta) {
    byLower.set(row.name.trim().toLowerCase(), { ...row });
  }

  const basisOrder = uniqueBasiswerteInOrder(trades);
  for (const basisName of basisOrder) {
    const lower = basisName.toLowerCase();
    if (!byLower.has(lower)) {
      byLower.set(lower, { name: basisName });
    }
  }

  const applied: string[] = [];

  for (const [, row] of byLower) {
    const suggestion = lookupKnownTickerSuggestion(row.name);
    if (!suggestion?.ticker?.trim()) continue;
    if (row.ticker?.trim()) continue;

    const next = { ...row, ticker: suggestion.ticker.trim() };
    byLower.set(row.name.trim().toLowerCase(), next);
    applied.push(row.name);
  }

  const nextMeta = [...byLower.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));

  const stillWithoutChartSymbol = basisOrder.filter((name) => {
    const row = byLower.get(name.toLowerCase());
    if (!row) return true;
    return !canResolveChartSymbol(row);
  });

  return {
    nextMeta,
    applied: [...new Set(applied)],
    stillWithoutChartSymbol
  };
}

export function countKnownTickerKeys(): number {
  return Object.keys(KNOWN_TICKER_SUGGESTIONS).length;
}
