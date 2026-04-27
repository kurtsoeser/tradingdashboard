import type { AssetMeta } from "../app/types";
import type { Trade } from "../types/trade";
import { sameBasiswertBucket } from "./basiswertCanonical";

export type ReconcileStatus = "ok" | "missing" | "uncertain";

export interface ReconcileSuggestion {
  isin?: string;
  wkn?: string;
  source: string;
  confidence: number;
}

export interface ReconcileRow {
  id: string;
  kind: "trade" | "asset";
  label: string;
  basiswert: string;
  currentIsin?: string;
  currentWkn?: string;
  suggestion?: ReconcileSuggestion;
  status: ReconcileStatus;
}

const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/g;
const WKN_RE = /\b[A-HJ-NPR-Z0-9]{6}\b/g;

function uniqueUpper(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim().toUpperCase()).filter((v): v is string => Boolean(v)))];
}

export function isValidIsin(value?: string): boolean {
  const isin = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const alpha = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const expanded = isin
    .split("")
    .map((c) => alpha.indexOf(c).toString())
    .join("");
  let sum = 0;
  const arr = expanded
    .split("")
    .map((n) => Number.parseInt(n, 10))
    .reverse();
  for (let i = 0; i < arr.length; i += 1) {
    let n = arr[i];
    if ((i + 1) % 2 === 0) {
      n *= 2;
      if (n > 9) n = Math.floor(n / 10) + (n % 10);
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function extractFromText(text: string): { isin?: string; wkn?: string } {
  const upper = text.toUpperCase();
  const isin = upper.match(ISIN_RE)?.[0];
  const wkn = upper.match(WKN_RE)?.[0];
  return { isin, wkn };
}

function chooseBestSuggestion(candidates: ReconcileSuggestion[]): ReconcileSuggestion | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
}

export function buildReconcileRows(trades: Trade[], assetMeta: AssetMeta[]): ReconcileRow[] {
  const rows: ReconcileRow[] = [];

  for (const trade of trades) {
    const currentIsin = trade.isin?.trim().toUpperCase();
    const currentWkn = trade.wkn?.trim().toUpperCase();
    const candidates: ReconcileSuggestion[] = [];

    const textExtract = extractFromText(`${trade.name} ${trade.basiswert} ${trade.notiz ?? ""}`);
    if (textExtract.isin || textExtract.wkn) {
      candidates.push({
        isin: textExtract.isin,
        wkn: textExtract.wkn,
        source: "Trade-Text",
        confidence: 0.98
      });
    }

    const relatedAsset = assetMeta.find((m) => sameBasiswertBucket(m.name, trade.basiswert));
    if (relatedAsset && (relatedAsset.isin || relatedAsset.wkn)) {
      candidates.push({
        isin: relatedAsset.isin?.trim().toUpperCase(),
        wkn: relatedAsset.wkn?.trim().toUpperCase(),
        source: "Basiswert-Metadaten",
        confidence: 0.9
      });
    }

    const suggestion = chooseBestSuggestion(candidates);
    const status: ReconcileStatus =
      !currentIsin
        ? "missing"
        : !isValidIsin(currentIsin) || (suggestion?.isin && suggestion.isin !== currentIsin && suggestion.confidence >= 0.95)
          ? "uncertain"
          : "ok";

    rows.push({
      id: `trade:${trade.id}`,
      kind: "trade",
      label: trade.name,
      basiswert: trade.basiswert,
      currentIsin,
      currentWkn,
      suggestion,
      status
    });
  }

  for (const asset of assetMeta) {
    const currentIsin = asset.isin?.trim().toUpperCase();
    const currentWkn = asset.wkn?.trim().toUpperCase();
    const candidates: ReconcileSuggestion[] = [];

    const textExtract = extractFromText(`${asset.name} ${asset.ticker ?? ""}`);
    if (textExtract.isin || textExtract.wkn) {
      candidates.push({
        isin: textExtract.isin,
        wkn: textExtract.wkn,
        source: "Basiswert-Text",
        confidence: 0.96
      });
    }

    const relatedTrades = trades.filter((t) => sameBasiswertBucket(t.basiswert, asset.name));
    const tradeIsins = uniqueUpper(relatedTrades.map((t) => t.isin)).filter((v) => isValidIsin(v));
    const tradeWkns = uniqueUpper(relatedTrades.map((t) => t.wkn));
    if (tradeIsins.length > 0 || tradeWkns.length > 0) {
      candidates.push({
        isin: tradeIsins[0],
        wkn: tradeWkns[0],
        source: "Verknüpfte Trades",
        confidence: 0.88
      });
    }

    const suggestion = chooseBestSuggestion(candidates);
    const status: ReconcileStatus =
      !currentIsin
        ? "missing"
        : !isValidIsin(currentIsin) || (suggestion?.isin && suggestion.isin !== currentIsin && suggestion.confidence >= 0.95)
          ? "uncertain"
          : "ok";

    rows.push({
      id: `asset:${asset.name.toLowerCase()}`,
      kind: "asset",
      label: asset.name,
      basiswert: asset.name,
      currentIsin,
      currentWkn,
      suggestion,
      status
    });
  }

  return rows;
}
