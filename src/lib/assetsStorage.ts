import type { AssetMeta } from "../app/types";
import { normalizeAndMergeAssetMetaList } from "./basiswertCanonical";

const ASSET_META_STORAGE_KEY = "trading-dashboard.assets.meta.v1";

/** Alte Speicherstände: tickerUs + tickerXetra → ein Feld ticker. */
function mergeLegacyTickerFields(raw: Record<string, unknown>): string | undefined {
  const single = typeof raw.ticker === "string" ? raw.ticker.trim() : "";
  if (single) return single;
  const us = typeof raw.tickerUs === "string" ? raw.tickerUs.trim() : "";
  const xe = typeof raw.tickerXetra === "string" ? raw.tickerXetra.trim() : "";
  const withColon = [us, xe].find((s) => s.includes(":"));
  if (withColon) return withColon;
  return us || xe || undefined;
}

export function normalizeStoredAssetMeta(items: unknown[]): AssetMeta[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      if (!raw || typeof raw !== "object") return { name: "" };
      const o = raw as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      const category = typeof o.category === "string" ? o.category.trim() : undefined;
      const waehrung = typeof o.waehrung === "string" ? o.waehrung.trim() : undefined;
      const ticker = mergeLegacyTickerFields(o);
      const out: AssetMeta = { name };
      if (category) out.category = category;
      if (ticker) out.ticker = ticker;
      if (waehrung) out.waehrung = waehrung;
      return out;
    })
    .filter((m) => m.name.length > 0);
}

function hasLegacyTickerKeys(items: unknown[]): boolean {
  for (const it of items) {
    if (it && typeof it === "object" && ("tickerUs" in it || "tickerXetra" in it)) return true;
  }
  return false;
}

export function loadAssetMetaFromStorage(): AssetMeta[] {
  try {
    const raw = localStorage.getItem(ASSET_META_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed) ? parsed : [];
    const normalized = normalizeStoredAssetMeta(arr);
    const { next: merged, changed: metaMergeChanged } = normalizeAndMergeAssetMetaList(normalized);
    const needsLegacySave = hasLegacyTickerKeys(arr);
    if (needsLegacySave || metaMergeChanged) {
      saveAssetMetaToStorage(merged);
    }
    return merged;
  } catch {
    return [];
  }
}

export function saveAssetMetaToStorage(items: AssetMeta[]): void {
  localStorage.setItem(ASSET_META_STORAGE_KEY, JSON.stringify(items));
}
