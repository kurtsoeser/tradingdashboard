import type { AppSettings } from "../app/settings";

/**
 * Öffnet eine Such-/Kursseite zum freien Suchbegriff (ISIN, WKN, Name …)
 * gemäß Einstellung „Finanzdienst“.
 */
export function buildFinanceSearchUrl(query: string, financeService: AppSettings["financeService"]): string {
  const q = query.trim();
  const enc = encodeURIComponent(q);
  switch (financeService) {
    case "yahoo":
      return `https://finance.yahoo.com/lookup?s=${enc}`;
    case "tradingview":
      return `https://www.tradingview.com/search/?query=${enc}`;
    case "investing":
      return `https://www.investing.com/search/?q=${enc}`;
    case "google":
    default:
      return `https://www.google.com/finance?q=${enc}`;
  }
}

export type LiveFinancePortalProvider = "google" | "yahoo" | "microsoft";

/** Für MSN-Detailseiten „fi-*“: kurzes Börsenkürzel, sonst null (Fallback mit ?query=). */
function msnFiTickerSlug(raw: string): string | null {
  const u = raw.trim().toUpperCase();
  if (/^[A-Z]{1,5}$/.test(u)) return u.toLowerCase();
  const m = /^[A-Z0-9]{1,8}:([A-Z]{1,5})$/.exec(u);
  if (m) return m[1].toLowerCase();
  return null;
}

/** URL zum Öffnen von Google-, Yahoo- oder Microsoft-Finanzseiten im Browser (neuer Tab). */
export function buildLiveFinancePortalUrl(query: string, provider: LiveFinancePortalProvider): string {
  const q = query.trim();
  const enc = encodeURIComponent(q);
  switch (provider) {
    case "yahoo":
      return `https://finance.yahoo.com/lookup?s=${enc}`;
    case "microsoft": {
      const slug = msnFiTickerSlug(q);
      if (slug) return `https://www.msn.com/en-us/money/stockdetails/fi-${slug}`;
      return `https://www.msn.com/en-us/money?query=${enc}`;
    }
    case "google":
    default:
      return `https://www.google.com/finance?q=${enc}`;
  }
}
