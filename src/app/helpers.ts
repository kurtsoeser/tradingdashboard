import { applyBasiswertMergeToTrades } from "../lib/basiswertCanonical";
import { loadTradesFromStorage, saveTradesToStorage } from "../lib/storage";
import type { Trade } from "../types/trade";

export function csvEscape(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const normalized = String(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

export function readInitialTrades(): Trade[] {
  const stored = loadTradesFromStorage();
  const { next, substitutions } = applyBasiswertMergeToTrades(stored);
  if (substitutions > 0) saveTradesToStorage(next);
  return next;
}
