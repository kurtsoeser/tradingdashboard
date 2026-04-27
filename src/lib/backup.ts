import type { AssetMeta } from "../app/types";
import type { AppSettings } from "../app/settings";
import type { Trade } from "../types/trade";
import { normalizeJournalData, type JournalData } from "./journalStorage";
import { normalizeStoredAssetMeta } from "./assetsStorage";

export const BACKUP_FORMAT_VERSION = 2 as const;

export const BACKUP_FORMAT_ID = "trading-dashboard-backup" as const;

export interface AppDataBackupV2 {
  format: typeof BACKUP_FORMAT_ID;
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  trades: Trade[];
  assetMeta: AssetMeta[];
  appSettings: AppSettings;
  theme: "dark" | "light";
  journal: JournalData;
  /** Freitext für den KI-Assistenten (Wissensbasis). */
  aiKnowledgeBase: string;
}

export interface BuildAppBackupInput {
  trades: Trade[];
  assetMeta: AssetMeta[];
  appSettings: AppSettings;
  theme: "dark" | "light";
  journal: JournalData;
  aiKnowledgeBase: string;
}

export interface ParsedTradesBackup {
  trades: Trade[];
  assetMeta?: AssetMeta[];
  /** Strukturiertes App-Backup: Basiswerte-Liste komplett ersetzen (auch leer). */
  replaceAssetMeta?: boolean;
  appSettings?: Partial<AppSettings>;
  theme?: "dark" | "light";
  journal?: JournalData;
  aiKnowledgeBase?: string;
}

function looksLikeTradeRow(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === "string" && o.name.trim().length > 0;
}

export function buildAppBackupJson(input: BuildAppBackupInput): string {
  const payload: AppDataBackupV2 = {
    format: BACKUP_FORMAT_ID,
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    trades: input.trades,
    assetMeta: input.assetMeta,
    appSettings: input.appSettings,
    theme: input.theme,
    journal: input.journal,
    aiKnowledgeBase: input.aiKnowledgeBase
  };
  return JSON.stringify(payload, null, 2);
}

/** Importiert aus JSON-Backup (v1/v2), reinem Trade-Array (Legacy) oder Objekt mit `trades`. */
export function parseTradesBackupImport(raw: unknown): ParsedTradesBackup | null {
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

  const out: ParsedTradesBackup = { trades };
  const isOurBackup = o.format === BACKUP_FORMAT_ID;

  const metaRaw = o.assetMeta ?? o.assets ?? o.asset_meta;
  if (isOurBackup && Array.isArray(metaRaw)) {
    out.assetMeta = normalizeStoredAssetMeta(metaRaw);
    out.replaceAssetMeta = true;
  } else if (Array.isArray(metaRaw) && metaRaw.length > 0) {
    out.assetMeta = normalizeStoredAssetMeta(metaRaw);
  }

  if (!isOurBackup) {
    return out;
  }

  if (o.appSettings && typeof o.appSettings === "object" && !Array.isArray(o.appSettings)) {
    out.appSettings = o.appSettings as Partial<AppSettings>;
  }

  if (o.theme === "dark" || o.theme === "light") {
    out.theme = o.theme;
  }

  const journalRaw = o.journal ?? o.tradingJournal;
  if (journalRaw !== undefined && journalRaw !== null) {
    out.journal = normalizeJournalData(journalRaw);
  }

  const kb = o.aiKnowledgeBase ?? o.aiKnowledge;
  if (typeof kb === "string") {
    out.aiKnowledgeBase = kb;
  }

  return out;
}
