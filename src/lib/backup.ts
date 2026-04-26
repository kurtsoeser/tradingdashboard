import type { AssetMeta } from "../app/types";
import type { Trade } from "../types/trade";
import { normalizeStoredAssetMeta } from "./assetsStorage";

export const BACKUP_FORMAT_VERSION = 1 as const;

export interface AppDataBackupV1 {
  format: "trading-dashboard-backup";
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  trades: Trade[];
  assetMeta: AssetMeta[];
}

function looksLikeTradeRow(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === "string" && o.name.trim().length > 0;
}

export function buildAppBackupJson(trades: Trade[], assetMeta: AssetMeta[]): string {
  const payload: AppDataBackupV1 = {
    format: "trading-dashboard-backup",
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    trades,
    assetMeta
  };
  return JSON.stringify(payload, null, 2);
}

/** Importiert aus JSON-Backup (v1), reinem Trade-Array (Legacy) oder Objekt mit `trades`. */
export function parseTradesBackupImport(raw: unknown): { trades: Trade[]; assetMeta?: AssetMeta[] } | null {
  if (Array.isArray(raw)) {
    const trades = raw.filter(looksLikeTradeRow) as Trade[];
    return trades.length > 0 ? { trades } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const arr = o.trades ?? o.data;
  if (!Array.isArray(arr)) return null;
  const trades = arr.filter(looksLikeTradeRow) as Trade[];
  if (trades.length === 0) return null;

  const metaRaw = o.assetMeta ?? o.assets ?? o.asset_meta;
  let assetMeta: AssetMeta[] | undefined;
  if (Array.isArray(metaRaw) && metaRaw.length > 0) {
    assetMeta = normalizeStoredAssetMeta(metaRaw);
  }
  return { trades, assetMeta };
}
