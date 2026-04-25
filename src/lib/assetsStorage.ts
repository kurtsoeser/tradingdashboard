import type { AssetMeta } from "../app/types";

const ASSET_META_STORAGE_KEY = "trading-dashboard.assets.meta.v1";

export function loadAssetMetaFromStorage(): AssetMeta[] {
  try {
    const raw = localStorage.getItem(ASSET_META_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssetMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAssetMetaToStorage(items: AssetMeta[]): void {
  localStorage.setItem(ASSET_META_STORAGE_KEY, JSON.stringify(items));
}
