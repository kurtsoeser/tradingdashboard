import type { AssetDisplayRow } from "../app/types";
import { resolvePlainTickerForTradingView } from "../data/tickerTradingViewAliases";

/**
 * TradingView-Symbol aus dem Ticker-Feld.
 * - Enthält der Wert schon „:“ (z. B. NYSE:TSM) → unverändert.
 * - Sonst: bekannte US-/ADR-Kürzel (z. B. TSM → NYSE:TSM), sonst XETR: für deutsche Xetra‑Listings (TradingView‑Präfix).
 *
 * Hinweis: Google Finance zeigt oft „NYSE: TSM“ — das Kürzel ist TSM, nicht der Kurzname „TSMC“.
 */
export function assetToTradingViewSymbol(asset: AssetDisplayRow): string | null {
  const t = asset.ticker?.trim();
  if (!t) return null;
  return resolvePlainTickerForTradingView(t);
}
