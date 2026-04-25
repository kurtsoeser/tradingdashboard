import { loadTradesFromStorage } from "../lib/storage";
import type { Trade } from "../types/trade";

export function csvEscape(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const normalized = String(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

export function readInitialTrades(): Trade[] {
  const stored = loadTradesFromStorage();
  return stored;
}
