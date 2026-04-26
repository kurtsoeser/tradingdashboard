import type { AssetMeta } from "../app/types";
import type { Trade } from "../types/trade";
import { BASISWERT_MERGE_GROUPS } from "../data/basiswertMergeGroups";
import { normalizeBasiswertKey } from "../data/knownAssetTickers";

function buildCanonicalByNormalizedKey(): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of BASISWERT_MERGE_GROUPS) {
    const canon = g.canonical.trim();
    const canonKey = normalizeBasiswertKey(canon);
    const assign = (key: string, label: string) => {
      const prev = map.get(key);
      if (prev !== undefined && prev !== label) {
        console.warn(
          `[basiswert merge] Konflikt für Schlüssel "${key}": "${prev}" vs. "${label}" — späterer Eintrag gewinnt.`
        );
      }
      map.set(key, label);
    };
    assign(canonKey, canon);
    for (const a of g.aliases) {
      const t = a.trim();
      if (!t) continue;
      assign(normalizeBasiswertKey(t), canon);
    }
  }
  return map;
}

const CANONICAL_BY_KEY = buildCanonicalByNormalizedKey();

/** Einheitlicher Basiswert-Name für Trades und Meta (Trim + ggf. Merge-Map). */
export function canonicalizeBasiswert(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return CANONICAL_BY_KEY.get(normalizeBasiswertKey(t)) ?? t;
}

/** Gleiche Basiswert-„Gruppe“ (Rohname und/oder Merge-Kanonik), z. B. Umbenennen im Asset-Dialog. */
export function sameBasiswertBucket(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  if (normalizeBasiswertKey(x) === normalizeBasiswertKey(y)) return true;
  return (
    normalizeBasiswertKey(canonicalizeBasiswert(x)) === normalizeBasiswertKey(canonicalizeBasiswert(y))
  );
}

function preferTicker(a?: string, b?: string): string | undefined {
  if (!a?.trim()) return b?.trim() || undefined;
  if (!b?.trim()) return a.trim();
  const at = a.trim();
  const bt = b.trim();
  if (at.includes(":") && !bt.includes(":")) return at;
  if (bt.includes(":") && !at.includes(":")) return bt;
  return bt.length > at.length ? bt : at;
}

function mergeTwoAssetMeta(a: AssetMeta, b: AssetMeta, displayName: string): AssetMeta {
  return {
    name: displayName,
    category: a.category?.trim() || b.category?.trim() || undefined,
    ticker: preferTicker(a.ticker, b.ticker),
    waehrung: a.waehrung?.trim() || b.waehrung?.trim() || undefined
  };
}

export function applyBasiswertMergeToTrades(trades: Trade[]): { next: Trade[]; substitutions: number } {
  let substitutions = 0;
  const next = trades.map((t) => {
    const c = canonicalizeBasiswert(t.basiswert);
    if (c !== t.basiswert) substitutions++;
    return c === t.basiswert ? t : { ...t, basiswert: c };
  });
  return { next, substitutions };
}

export function normalizeAndMergeAssetMetaList(items: AssetMeta[]): {
  next: AssetMeta[];
  mergedPairs: number;
  changed: boolean;
} {
  let mergedPairs = 0;
  let renamedOnly = false;
  const orderKeys: string[] = [];
  const map = new Map<string, AssetMeta>();

  for (const m of items) {
    const trimmed = m.name.trim();
    const nameCanon = canonicalizeBasiswert(trimmed);
    if (nameCanon !== trimmed) renamedOnly = true;
    if (!nameCanon) continue;
    const key = normalizeBasiswertKey(nameCanon);
    const row: AssetMeta = {
      ...m,
      name: nameCanon
    };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      orderKeys.push(key);
    } else {
      mergedPairs++;
      map.set(key, mergeTwoAssetMeta(existing, row, nameCanon));
    }
  }

  const next = orderKeys.map((k) => map.get(k)!);
  const changed = mergedPairs > 0 || renamedOnly || next.length !== items.length;
  return { next, mergedPairs, changed };
}

/** Trades, deren basiswert sich durch Canonicalisierung ändert (Vorschau). */
export function countTradeBasiswertRenames(trades: Trade[]): number {
  return trades.filter((t) => canonicalizeBasiswert(t.basiswert) !== t.basiswert).length;
}

/** Meta-Zeilen, die mit einer anderen Zeile zur selben canonical-Gruppe kollidieren würden. */
export function countAssetMetaDuplicateGroups(items: AssetMeta[]): number {
  const seen = new Set<string>();
  let dup = 0;
  for (const m of items) {
    const key = normalizeBasiswertKey(canonicalizeBasiswert(m.name.trim()));
    if (!key) continue;
    if (seen.has(key)) dup++;
    else seen.add(key);
  }
  return dup;
}
