import type { Trade } from "../types/trade";

/** v2: neue CSV-Struktur (€, …); alte localStorage-Daten werden nicht mehr gemischt */
const STORAGE_KEY = "trading-dashboard.trades.v2";

export function loadTradesFromStorage(): Trade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Trade[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTradesToStorage(trades: Trade[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}
