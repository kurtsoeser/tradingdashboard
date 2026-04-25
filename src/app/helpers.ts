import initialCsv from "../../Trades.csv?raw";
import { parseTradesCsv } from "../lib/csv";
import { loadTradesFromStorage, saveTradesToStorage } from "../lib/storage";
import type { Trade } from "../types/trade";

export function csvEscape(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const normalized = String(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

export function readInitialTrades(): Trade[] {
  const stored = loadTradesFromStorage();
  if (stored.length > 0) return stored;
  const initial = parseTradesCsv(initialCsv);
  saveTradesToStorage(initial);
  return initial;
}
