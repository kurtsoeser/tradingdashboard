import type { AssetMeta } from "../app/types";
import type { AppSettings } from "../app/settings";
import type { Trade } from "../types/trade";
import { assignLegacyLegs, cloneBookings, syntheticBookingsFromTrade } from "./bookingsDraft";
import { normalizeJournalData, type JournalData } from "./journalStorage";
import { normalizeStoredAssetMeta } from "./assetsStorage";

export const BACKUP_FORMAT_VERSION = 3 as const;

export const BACKUP_FORMAT_ID = "trading-dashboard-backup" as const;

/** Gleicher Key wie in `TradesView` (Spaltenreihenfolge / Sichtbarkeit). */
export const TRADES_COLUMN_PREFS_STORAGE_KEY = "trades-columns-v1" as const;

export type TradesTableColumnPrefs = {
  order: string[];
  visible: Record<string, boolean>;
};

export interface AppDataBackupPayload {
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
  /** Ab v3: Trades-Tabelle Spalten (localStorage). */
  tradesTableColumnPrefs?: TradesTableColumnPrefs;
}

/** @deprecated Alias — Nutz `AppDataBackupPayload`. */
export type AppDataBackupV2 = AppDataBackupPayload;

export interface BuildAppBackupInput {
  trades: Trade[];
  assetMeta: AssetMeta[];
  appSettings: AppSettings;
  theme: "dark" | "light";
  journal: JournalData;
  aiKnowledgeBase: string;
  /** Optional: Tests/SSR ohne `window`; sonst aus localStorage gelesen. */
  tradesTableColumnPrefs?: TradesTableColumnPrefs | null;
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
  tradesTableColumnPrefs?: TradesTableColumnPrefs;
}

function looksLikeTradeRow(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === "string" && o.name.trim().length > 0;
}

/** Jeder Trade mit vollständigen `bookings` (Cloud-Parität), inkl. `legacyLeg`. */
export function normalizeTradesForBackupExport(trades: Trade[]): Trade[] {
  return trades.map((trade) => {
    const has = trade.bookings && trade.bookings.length > 0;
    const rows = has ? cloneBookings(trade.bookings!) : syntheticBookingsFromTrade(trade);
    return { ...trade, bookings: assignLegacyLegs(rows) };
  });
}

export function readTradesColumnPrefsFromLocalStorage(): TradesTableColumnPrefs | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(TRADES_COLUMN_PREFS_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { order?: unknown; visible?: unknown };
    if (!Array.isArray(parsed.order) || typeof parsed.visible !== "object" || parsed.visible === null || Array.isArray(parsed.visible)) {
      return undefined;
    }
    const order = parsed.order.filter((id): id is string => typeof id === "string");
    if (order.length === 0) return undefined;
    return { order, visible: { ...(parsed.visible as Record<string, boolean>) } };
  } catch {
    return undefined;
  }
}

export function buildAppBackupJson(input: BuildAppBackupInput): string {
  const columnPrefs =
    input.tradesTableColumnPrefs === null ? undefined : input.tradesTableColumnPrefs ?? readTradesColumnPrefsFromLocalStorage();

  const payload: AppDataBackupPayload = {
    format: BACKUP_FORMAT_ID,
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    trades: normalizeTradesForBackupExport(input.trades),
    assetMeta: input.assetMeta,
    appSettings: input.appSettings,
    theme: input.theme,
    journal: input.journal,
    aiKnowledgeBase: input.aiKnowledgeBase,
    ...(columnPrefs ? { tradesTableColumnPrefs: columnPrefs } : {})
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

  const prefsRaw = o.tradesTableColumnPrefs;
  if (
    prefsRaw &&
    typeof prefsRaw === "object" &&
    !Array.isArray(prefsRaw) &&
    Array.isArray((prefsRaw as Record<string, unknown>).order) &&
    typeof (prefsRaw as Record<string, unknown>).visible === "object" &&
    (prefsRaw as Record<string, unknown>).visible !== null &&
    !Array.isArray((prefsRaw as Record<string, unknown>).visible)
  ) {
    const pr = prefsRaw as { order: unknown[]; visible: Record<string, unknown> };
    const order = pr.order.filter((x): x is string => typeof x === "string");
    if (order.length > 0) {
      out.tradesTableColumnPrefs = {
        order,
        visible: Object.fromEntries(
          Object.entries(pr.visible).filter(([, v]) => typeof v === "boolean")
        ) as Record<string, boolean>
      };
    }
  }

  return out;
}
