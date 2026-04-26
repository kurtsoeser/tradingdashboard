/**
 * Symbol-Suche über die OpenFIGI API (Bloomberg), öffentlich nutzbar mit Rate-Limits.
 * @see https://www.openfigi.com/api
 */

export interface OpenFigiSearchHit {
  figi: string;
  name: string;
  ticker: string;
  exchCode: string | null;
  securityType: string;
  securityType2: string | null;
}

/** Typische Xetra-/Deutschland-Bloomberg-Börsencodes (OpenFIGI exchCode). */
const GERMAN_DOMESTIC_EXCH = new Set([
  "GR",
  "GS",
  "GI",
  "XE",
  "XT",
  "XH",
  "XG",
  "GD",
  "GH",
  "GL",
  "E1",
  "XS",
  "X1",
  "LA",
  "EZ",
  "EP",
  "RO",
  "HB",
  "AV",
  "LU",
  "PW",
  "X9",
  "XX",
  "SW",
  "XM",
  "XF",
  "XN"
]);

const US_LISTING_EXCH = new Set(["UN", "UW", "US", "UX", "UA", "UM", "VY", "VJ", "OC", "UQ", "UF"]);

function isFilteredOut(row: OpenFigiSearchHit): boolean {
  const t = row.ticker ?? "";
  if (t.includes("=") || t.includes("/")) return true;
  const st2 = (row.securityType2 ?? "").toLowerCase();
  if (st2.includes("future") || st2.includes("option")) return true;
  const st = (row.securityType ?? "").toLowerCase();
  if (st.includes("crypto")) return true;
  if (!row.exchCode && st !== "adr") return false;
  return false;
}

function score(row: OpenFigiSearchHit): number {
  let s = 0;
  const ex = row.exchCode ?? "";
  if (GERMAN_DOMESTIC_EXCH.has(ex)) s += 80;
  if (US_LISTING_EXCH.has(ex)) s += 40;
  const st2 = row.securityType2 ?? "";
  if (st2 === "Common Stock") s += 20;
  if (st2 === "Depositary Receipt" || (row.securityType ?? "").toLowerCase().includes("adr")) s += 25;
  if (row.name.length < 80) s += 1;
  return s;
}

export function suggestTickerUsFromHit(row: OpenFigiSearchHit): string {
  const t = row.ticker.trim();
  const st2 = row.securityType2 ?? "";
  const ex = row.exchCode ?? "";
  if (st2 === "Depositary Receipt" || (row.securityType ?? "").toLowerCase().includes("adr")) {
    return `NYSE:${t}`;
  }
  if (US_LISTING_EXCH.has(ex)) {
    if (ex === "UN" || ex === "UW" || ex === "UF") return `NASDAQ:${t}`;
    return `NYSE:${t}`;
  }
  return `NASDAQ:${t}`;
}

export function suggestTickerXetraFromHit(row: OpenFigiSearchHit): string | null {
  const ex = row.exchCode ?? "";
  if (!GERMAN_DOMESTIC_EXCH.has(ex)) return null;
  return row.ticker.trim();
}

function openFigiSearchUrl(): string {
  return import.meta.env.DEV ? "/openfigi/v3/search" : "https://api.openfigi.com/v3/search";
}

export async function searchSymbolsOpenFigi(query: string, signal?: AbortSignal): Promise<OpenFigiSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(openFigiSearchUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
    signal
  });

  if (!res.ok) {
    throw new Error(`OpenFIGI: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: OpenFigiSearchHit[] };
  const raw = json.data ?? [];
  const filtered = raw.filter((r) => r?.ticker && r?.name && !isFilteredOut(r));
  const scored = [...filtered].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  return scored.slice(0, 40);
}
