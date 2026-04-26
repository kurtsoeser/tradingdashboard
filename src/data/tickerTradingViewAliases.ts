/**
 * Kürzel ohne Börsen-Präfix → vollständiges TradingView-Symbol.
 * Hintergrund: Ohne ":" ergänzt die App Xetra als XETR: (TradingView-Präfix; „XETRA:“ erkennt das Widget nicht).
 * aber nicht zu US-Aktien/ADRs (z. B. TSMC an der NYSE = Kürzel TSM, Google Finance: NYSE:TSM).
 *
 * Ergänzungen: immer mit Präfix im Basiswert eintragen (z. B. NYSE:NEM), dann ist keine Zuordnung nötig.
 */
export const PLAIN_TICKER_TO_TRADINGVIEW: Record<string, string> = {
  // TSMC / Taiwan Semiconductor (ADR NYSE)
  tsm: "NYSE:TSM",
  tsmc: "NYSE:TSM",

  spot: "NYSE:SPOT",
  spotify: "NYSE:SPOT",

  dell: "NYSE:DELL",
  eunk: "XETRA:EUNK",
  evd: "XETRA:EVD",
  "0b2": "XETRA:0B2",

  // Weitere häufige US-Listings (Kürzel ≠ deutscher Name)
  baba: "NYSE:BABA",
  asml: "NASDAQ:ASML",
  nvo: "NYSE:NVO",
  shop: "NYSE:SHOP",
  jd: "NASDAQ:JD",
  pdd: "NASDAQ:PDD",
  bidu: "NASDAQ:BIDU",
  coin: "NASDAQ:COIN",
  mrvl: "NASDAQ:MRVL",
  lrcx: "NASDAQ:LRCX",
  klac: "NASDAQ:KLAC",
  amat: "NASDAQ:AMAT",
  txn: "NASDAQ:TXN",
  qcom: "NASDAQ:QCOM",
  mu: "NASDAQ:MU",
  amd: "NASDAQ:AMD",
  intc: "NASDAQ:INTC",
  nvda: "NASDAQ:NVDA",
  tsla: "NASDAQ:TSLA",
  meta: "NASDAQ:META",
  nflx: "NASDAQ:NFLX",
  aapl: "NASDAQ:AAPL",
  msft: "NASDAQ:MSFT",
  googl: "NASDAQ:GOOGL",
  goog: "NASDAQ:GOOG",
  amzn: "NASDAQ:AMZN",
  pypl: "NASDAQ:PYPL",
  adbe: "NASDAQ:ADBE",
  csco: "NASDAQ:CSCO",
  avgo: "NASDAQ:AVGO",
  cost: "NASDAQ:COST",
  sbux: "NASDAQ:SBUX",
  pep: "NASDAQ:PEP",
  ko: "NYSE:KO",
  dis: "NYSE:DIS",
  mcd: "NYSE:MCD",
  hd: "NYSE:HD",
  wmt: "NYSE:WMT",
  jpm: "NYSE:JPM",
  bac: "NYSE:BAC",
  wfc: "NYSE:WFC",
  gs: "NYSE:GS",
  ms: "NYSE:MS",
  xom: "NYSE:XOM",
  cvx: "NYSE:CVX",
  shel: "NYSE:SHEL",
  pfe: "NYSE:PFE",
  jnj: "NYSE:JNJ",
  unh: "NYSE:UNH",
  lly: "NYSE:LLY",
  ma: "NYSE:MA",
  v: "NYSE:V",
  ba: "NYSE:BA",
  cat: "NYSE:CAT",
  orcl: "NYSE:ORCL",
  crm: "NYSE:CRM",
  brkb: "NYSE:BRK.B",
  "brk.b": "NYSE:BRK.B",
  qgen: "NASDAQ:QGEN",
  lin: "NASDAQ:LIN"
};

export function resolvePlainTickerForTradingView(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  let out: string;
  if (t.includes(":")) {
    out = t;
  } else {
    const mapped = PLAIN_TICKER_TO_TRADINGVIEW[t.toLowerCase()];
    out = mapped ?? `XETR:${t.toUpperCase()}`;
  }
  // TradingView-Widget: Xetra = Präfix XETR (nicht XETRA) — sonst „This symbol doesn't exist“.
  return out.replace(/^XETRA:/i, "XETR:");
}
