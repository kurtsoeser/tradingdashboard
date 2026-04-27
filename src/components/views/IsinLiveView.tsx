import { useEffect, useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { t } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import { TradingViewLiveChart } from "../TradingViewLiveChart";
import {
  searchByIsinOpenFigi,
  searchByWknOpenFigi,
  searchSymbolsOpenFigi,
  tradingViewSymbolFromOpenFigiHit,
  type OpenFigiSearchHit
} from "../../lib/openFigiSearch";
import { resolvePlainTickerForTradingView } from "../../data/tickerTradingViewAliases";
import { lookupKnownTickerSuggestion, normalizeBasiswertKey } from "../../data/knownAssetTickers";
import { buildLiveFinancePortalUrl, type LiveFinancePortalProvider } from "../../lib/financeLinks";

interface IsinLiveViewProps {
  language: AppSettings["language"];
  chartTheme: "dark" | "light";
}

export function IsinLiveView({ language, chartTheme }: IsinLiveViewProps) {
  const [queryInput, setQueryInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<OpenFigiSearchHit[]>([]);
  const [selectedFigi, setSelectedFigi] = useState<string | null>(null);
  const [directSymbol, setDirectSymbol] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<OpenFigiSearchHit[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [allowEur, setAllowEur] = useState(true);
  const [allowUsd, setAllowUsd] = useState(true);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);

  const normalizedQuery = queryInput.trim().toUpperCase();
  const knownTickerCore = useMemo(() => {
    const known = lookupKnownTickerSuggestion(normalizeBasiswertKey(queryInput));
    const mapped = known?.ticker ? resolvePlainTickerForTradingView(known.ticker) : null;
    if (!mapped) return null;
    const parts = mapped.split(":");
    return (parts[1] ?? parts[0] ?? "").toUpperCase();
  }, [queryInput]);
  const isValidIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalizedQuery);
  const looksLikeWkn = /^[A-HJ-NPR-Z0-9]{6}$/.test(normalizedQuery);
  const looksLikeTicker = /^[A-Z0-9._-]{1,15}(:[A-Z0-9._-]{1,20})?$/.test(normalizedQuery);
  const shouldUseDirectTicker =
    looksLikeTicker &&
    (normalizedQuery.includes(":") || /^[A-Z]{1,5}$/.test(normalizedQuery) || /^[A-Z0-9]{1,6}$/.test(normalizedQuery));
  const looksLikeDerivativeText = /(LONG|SHORT|TURBO|KNOCK|KO|CALL|PUT|HEBEL|ZERTIFIKAT|WARRANT)/i.test(normalizedQuery);

  const selectedHitRaw = useMemo(
    () => (selectedFigi ? hits.find((hit) => hit.figi === selectedFigi) ?? null : hits[0] ?? null),
    [hits, selectedFigi]
  );
  const inferCurrency = (exchCode: string | null): "EUR" | "USD" | "OTHER" => {
    const ex = (exchCode ?? "").toUpperCase();
    if (
      ex === "US" ||
      ex.startsWith("U") ||
      ["NYSE", "NASDAQ", "NYSE ARCA", "NYSE AMERICAN", "BATS", "CBOE", "OTC", "PINK", "NMS"].includes(ex)
    ) {
      return "USD";
    }
    if (
      [
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
        "XN",
        "XETR",
        "STUTTGART",
        "TRADEGATE"
      ].includes(ex)
    )
      return "EUR";
    return "OTHER";
  };
  const inferCurrencyFromTicker = (tickerRaw: string | null | undefined): "EUR" | "USD" | "OTHER" => {
    const ticker = (tickerRaw ?? "").toUpperCase();
    if (ticker.endsWith("USD")) return "USD";
    if (ticker.endsWith("EUR")) return "EUR";
    return "OTHER";
  };
  const exchangeLabel = (ex: string): string => {
    const map: Record<string, string> = {
      UN: "NYSE/Nasdaq (US)",
      UW: "Nasdaq (US)",
      US: "US Exchange",
      UQ: "Nasdaq (US)",
      UF: "Nasdaq (US)",
      UA: "NYSE Arca (US)",
      UX: "NYSE American (US)",
      XETR: "Xetra (DE)",
      STUTTGART: "Börse Stuttgart (DE)",
      TRADEGATE: "Tradegate (DE)",
      XE: "Xetra (DE)",
      XT: "Xetra (DE)",
      XS: "SIX Swiss Exchange (CH)",
      SW: "SIX Swiss Exchange (CH)",
      N_A: "Unbekannt"
    };
    return map[ex] ?? t(language, "liveLookupExchangeUnknown");
  };
  const displayCurrency = (hit: OpenFigiSearchHit): string => {
    const byTicker = inferCurrencyFromTicker(hit.ticker);
    const c = byTicker !== "OTHER" ? byTicker : inferCurrency(hit.exchCode);
    if (c === "EUR") return "💶 EUR";
    if (c === "USD") return "💵 USD";
    return t(language, "liveLookupCurrencyUnknown");
  };
  const normalizeExchange = (exchCode: string | null): string => (exchCode ?? "N/A").toUpperCase();
  const isAllowedByCurrency = (hit: OpenFigiSearchHit): boolean => {
    const byTicker = inferCurrencyFromTicker(hit.ticker);
    const c = byTicker !== "OTHER" ? byTicker : inferCurrency(hit.exchCode);
    if (c === "EUR") return allowEur;
    if (c === "USD") return allowUsd;
    return true;
  };
  const prioritizeRows = (rows: OpenFigiSearchHit[]): OpenFigiSearchHit[] => {
    const instrumentPriority = (hit: OpenFigiSearchHit): number => {
      const st = `${hit.securityType ?? ""} ${hit.securityType2 ?? ""}`.toLowerCase();
      const nm = (hit.name ?? "").toLowerCase();
      const derivateHints = ["warrant", "option", "knock", "turbo", "zertifikat", "derivat", "faktor", "mini future", "open end"];

      if (st.includes("common stock") || st.includes("equity") || st.includes("stock")) return 300;
      if (st.includes("depositary receipt") || st.includes("adr") || nm.includes("adr")) return 200;
      if (derivateHints.some((h) => st.includes(h) || nm.includes(h))) return 100;
      return 150;
    };
    const scoreRow = (hit: OpenFigiSearchHit): number => {
      let score = 0;
      const ticker = (hit.ticker ?? "").toUpperCase();
      const ex = (hit.exchCode ?? "").toUpperCase();
      score += instrumentPriority(hit);
      if (knownTickerCore && ticker === knownTickerCore) score += 120;
      if (["UN", "UW", "UA", "UX", "UQ", "US", "NASDAQ", "NYSE"].includes(ex)) score += 80;
      if ((hit.securityType2 ?? "").toLowerCase().includes("common stock")) score += 40;
      if ((hit.securityType ?? "").toLowerCase().includes("equity")) score += 25;
      if ((hit.name ?? "").toUpperCase().includes(normalizedQuery)) score += 8;
      return score;
    };
    return [...rows].sort((a, b) => scoreRow(b) - scoreRow(a) || a.name.localeCompare(b.name));
  };
  const exchangeOptions = useMemo(() => {
    const fromData = [...hits, ...suggestions].map((h) => normalizeExchange(h.exchCode));
    const unique = [...new Set(fromData)].filter(Boolean);
    if (unique.length > 0) return unique.sort((a, b) => a.localeCompare(b));
    return ["N/A"];
  }, [hits, suggestions]);
  useEffect(() => {
    setSelectedExchanges((prev) => prev.filter((ex) => exchangeOptions.includes(ex)));
  }, [exchangeOptions]);
  const isAllowedByExchange = (hit: OpenFigiSearchHit): boolean => {
    if (selectedExchanges.length === 0) return true;
    return selectedExchanges.includes(normalizeExchange(hit.exchCode));
  };
  const filteredHits = useMemo(
    () => hits.filter((h) => isAllowedByCurrency(h) && isAllowedByExchange(h)),
    [hits, allowEur, allowUsd, selectedExchanges]
  );
  const filteredSuggestions = useMemo(
    () => suggestions.filter((h) => isAllowedByCurrency(h) && isAllowedByExchange(h)),
    [suggestions, allowEur, allowUsd, selectedExchanges]
  );
  const selectedHit = useMemo(
    () => (selectedHitRaw && isAllowedByCurrency(selectedHitRaw) ? selectedHitRaw : filteredHits[0] ?? null),
    [selectedHitRaw, filteredHits, allowEur, allowUsd]
  );
  const selectedSymbol = directSymbol || (selectedHit ? tradingViewSymbolFromOpenFigiHit(selectedHit) : null);
  const portalSearchTerm = useMemo(() => {
    if (selectedSymbol) {
      const parts = selectedSymbol.split(":");
      const tail = (parts[1] ?? parts[0]).trim();
      if (tail) return tail.toUpperCase();
    }
    return normalizedQuery;
  }, [selectedSymbol, normalizedQuery]);
  const majorPortalLinks = useMemo(() => {
    if (!portalSearchTerm) return [];
    const keys: LiveFinancePortalProvider[] = ["google", "yahoo", "microsoft"];
    return keys.map((key) => ({
      key,
      url: buildLiveFinancePortalUrl(portalSearchTerm, key),
      label:
        key === "google"
          ? t(language, "liveLookupPortalGoogle")
          : key === "yahoo"
            ? t(language, "liveLookupPortalYahoo")
            : t(language, "liveLookupPortalMicrosoft")
    }));
  }, [portalSearchTerm, language]);
  const providerLinks = useMemo(() => {
    if (!normalizedQuery) return [];
    const q = encodeURIComponent(normalizedQuery);
    return [
      { key: "onvista", label: "onvista", url: `https://www.onvista.de/suche/?SEARCH_VALUE=${q}` },
      { key: "finanzen", label: "finanzen.net", url: `https://www.finanzen.net/suchergebnis.asp?_search=${q}` },
      { key: "hsbc", label: "HSBC Zertifikate", url: `https://www.hsbc-zertifikate.de/home/suche?suchbegriff=${q}` },
      { key: "sg", label: "SG Derivate", url: `https://www.sg-zertifikate.de/search?search=${q}` },
      { key: "vontobel", label: "Vontobel Derivate", url: `https://certificates.vontobel.com/DE/DE/Products/Search?search=${q}` },
      { key: "onemarkets", label: "onemarkets", url: `https://www.onemarkets.de/de/suche.html?q=${q}` }
    ];
  }, [normalizedQuery]);
  const providerHint = useMemo(() => {
    if (!normalizedQuery) return null;
    const q = normalizedQuery;
    const word = queryInput.trim().toUpperCase();
    const searchUrl = (base: string) => `${base}${encodeURIComponent(q)}`;

    if (q.startsWith("HM") || q.includes("HSBC")) {
      return {
        provider: "hsbc",
        label: t(language, "liveLookupHintHsbc"),
        url: searchUrl("https://www.hsbc-zertifikate.de/home/suche?suchbegriff=")
      };
    }
    if (q.startsWith("SG") || q.includes("SOCIETE") || q.includes("SOCGEN")) {
      return {
        provider: "sg",
        label: t(language, "liveLookupHintSg"),
        url: searchUrl("https://www.sg-zertifikate.de/search?search=")
      };
    }
    if (q.startsWith("VQ") || q.startsWith("VT") || q.includes("VONTOBEL")) {
      return {
        provider: "vontobel",
        label: t(language, "liveLookupHintVontobel"),
        url: searchUrl("https://certificates.vontobel.com/DE/DE/Products/Search?search=")
      };
    }
    if (q.startsWith("UN") || q.includes("UNICREDIT") || q.includes("ONEMARKETS")) {
      return {
        provider: "onemarkets",
        label: t(language, "liveLookupHintOnemarkets"),
        url: searchUrl("https://www.onemarkets.de/de/suche.html?q=")
      };
    }
    if (/(LONG|SHORT|TURBO|KNOCK|KO|CALL|PUT|HEBEL|ZERTIFIKAT|WARRANT)/i.test(word)) {
      return {
        provider: "derivative",
        label: t(language, "liveLookupHintDerivateGeneral"),
        url: searchUrl("https://www.onvista.de/suche/?SEARCH_VALUE=")
      };
    }
    return null;
  }, [language, normalizedQuery, queryInput]);
  const hsbcPriorityUrl = useMemo(() => {
    if (!normalizedQuery) return null;
    if (!isValidIsin && !looksLikeWkn) return null;
    return `https://www.hsbc-zertifikate.de/home/suche?suchbegriff=${encodeURIComponent(normalizedQuery)}`;
  }, [normalizedQuery, isValidIsin, looksLikeWkn]);
  const buildKnownFallbackHit = (rawQuery: string): OpenFigiSearchHit | null => {
    const known = lookupKnownTickerSuggestion(normalizeBasiswertKey(rawQuery));
    const mapped = known?.ticker ? resolvePlainTickerForTradingView(known.ticker) : null;
    if (!mapped) return null;
    const [exch, ticker] = mapped.includes(":") ? mapped.split(":") : ["N/A", mapped];
    return {
      figi: `known-${normalizeBasiswertKey(rawQuery)}`,
      name: rawQuery.trim(),
      ticker,
      exchCode: exch || null,
      securityType: "Known Mapping",
      securityType2: "Known Mapping"
    };
  };

  const runSearch = async () => {
    if (!normalizedQuery) return;
    setLoading(true);
    setError(null);
    setHits([]);
    setSelectedFigi(null);
    setDirectSymbol(null);
    try {
      if (isValidIsin) {
        const nextHits = await searchByIsinOpenFigi(normalizedQuery);
        setHits(nextHits);
        if (nextHits.length > 0) setSelectedFigi(nextHits[0].figi);
        return;
      }
      if (looksLikeWkn) {
        const nextHits = await searchByWknOpenFigi(normalizedQuery);
        setHits(nextHits);
        if (nextHits.length > 0) setSelectedFigi(nextHits[0].figi);
        return;
      }
      if (shouldUseDirectTicker) {
        const symbol = resolvePlainTickerForTradingView(normalizedQuery);
        if (symbol) {
          setDirectSymbol(symbol);
          setHits([]);
          return;
        }
      }
      const nextHits = await searchSymbolsOpenFigi(normalizedQuery);
      if (nextHits.length > 0) {
        const prioritized = prioritizeRows(nextHits);
        setHits(prioritized);
        setSelectedFigi(prioritized[0].figi);
      } else {
        const fallback = buildKnownFallbackHit(queryInput);
        if (fallback) {
          setHits([fallback]);
          setSelectedFigi(fallback.figi);
        } else {
          setHits([]);
        }
      }
    } catch {
      setError(t(language, "liveLookupError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = queryInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    if (isValidIsin || looksLikeWkn) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true);
      void searchSymbolsOpenFigi(q, controller.signal)
        .then((rows) => {
          if (rows.length > 0) {
            setSuggestions(prioritizeRows(rows).slice(0, 8));
            return;
          }
          const fallback = buildKnownFallbackHit(q);
          setSuggestions(fallback ? [fallback] : []);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => setSuggestionsLoading(false));
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [queryInput, isValidIsin, looksLikeWkn]);

  return (
    <section className="section">
      <div className="page-header">
        <div className="page-header-copy">
          <h2 className="page-header-title">
            <Activity size={18} />
            {t(language, "liveLookupTitle")}
          </h2>
          <p>{t(language, "liveLookupSubtitle")}</p>
        </div>
      </div>

      <div className="card isin-live-card">
        <div className="isin-search-row">
          <label className="isin-search-label" htmlFor="live-lookup-input">
            {t(language, "liveLookupInputLabel")}
            <input
              id="live-lookup-input"
              value={queryInput}
              onChange={(event) => {
                setQueryInput(event.target.value.toUpperCase());
                setSelectedExchanges([]);
              }}
              placeholder={t(language, "liveLookupInputPlaceholder")}
            />
          </label>
          <button className="primary" onClick={() => void runSearch()} disabled={!normalizedQuery || loading}>
            <Search size={14} />
            {loading ? t(language, "editAssetSearching") : t(language, "liveLookupSearchBtn")}
          </button>
        </div>
        {queryInput.trim().length >= 2 && !isValidIsin && !looksLikeWkn && (
          <div className="live-suggest-box">
            <div className="live-suggest-head">{t(language, "liveLookupSuggestions")}</div>
            {suggestionsLoading && <p className="live-chart-hint live-chart-hint-compact">{t(language, "editAssetSearching")}</p>}
            {!suggestionsLoading && filteredSuggestions.length === 0 && <p className="live-chart-empty">{t(language, "liveLookupNoSuggestions")}</p>}
            {!suggestionsLoading && filteredSuggestions.length > 0 && (
              <div className="live-suggest-list">
                {filteredSuggestions.map((hit) => (
                  <button
                    key={`s-${hit.figi}`}
                    type="button"
                    className="live-suggest-item"
                    onClick={() => {
                      setHits([hit]);
                      setSelectedFigi(hit.figi);
                      setDirectSymbol(null);
                      setSuggestions([]);
                      setQueryInput(hit.name);
                    }}
                  >
                    <strong>{hit.name}</strong>
                    <span>
                      {hit.exchCode || "N/A"}:{hit.ticker} · {t(language, "currencyCol")}: {displayCurrency(hit)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="live-filter-row">
          <span className="live-filter-label">{t(language, "liveLookupCurrencyFilter")}:</span>
          <label className="equity-check">
            <input type="checkbox" checked={allowEur} onChange={(e) => setAllowEur(e.target.checked)} />
            EUR
          </label>
          <label className="equity-check">
            <input type="checkbox" checked={allowUsd} onChange={(e) => setAllowUsd(e.target.checked)} />
            USD
          </label>
        </div>
        <div className="live-filter-row">
          <span className="live-filter-label">{t(language, "liveLookupExchangeFilter")}:</span>
          <button type="button" className={`secondary slim ${selectedExchanges.length === 0 ? "active" : ""}`} onClick={() => setSelectedExchanges([])}>
            {t(language, "all")}
          </button>
          {exchangeOptions.map((ex) => {
            const active = selectedExchanges.includes(ex);
            return (
              <button
                key={ex}
                type="button"
                className={`secondary slim ${active ? "active" : ""}`}
                onClick={() =>
                  setSelectedExchanges((prev) => (prev.includes(ex) ? prev.filter((x) => x !== ex) : [...prev, ex]))
                }
              >
                {ex} · {exchangeLabel(ex === "N/A" ? "N_A" : ex)}
              </button>
            );
          })}
        </div>
        <p className="live-chart-hint live-chart-hint-compact">{t(language, "liveLookupHint")}</p>
        {(looksLikeWkn || looksLikeDerivativeText || isValidIsin) && (
          <p className="live-chart-hint live-chart-hint-compact">{t(language, "liveLookupDerivateHint")}</p>
        )}
        {hsbcPriorityUrl && (
          <div className="live-provider-priority">
            <a className="primary live-priority-link" href={hsbcPriorityUrl} target="_blank" rel="noreferrer">
              {t(language, "liveLookupHsbcQuick")}
            </a>
          </div>
        )}
        {providerHint && (
          <div className="live-provider-priority">
            <a className="secondary live-priority-link" href={providerHint.url} target="_blank" rel="noreferrer">
              {providerHint.label}
            </a>
          </div>
        )}
        {error && <p className="edit-asset-search-error">{error}</p>}
        {providerLinks.length > 0 && (
          <div className="live-provider-links">
            {providerLinks.map((item) => (
              <a key={item.key} className="secondary slim" href={item.url} target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ))}
          </div>
        )}
        {majorPortalLinks.length > 0 && (
          <>
            <p className="live-chart-hint live-chart-hint-compact">{t(language, "liveLookupPortalTitle")}</p>
            <div className="live-provider-links">
              {majorPortalLinks.map((item) => (
                <a key={item.key} className="secondary slim" href={item.url} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {(filteredHits.length > 0 || directSymbol) && (
        <div className="card isin-results-card">
          {filteredHits.length > 1 && (
            <label className="live-chart-select-label">
              {t(language, "liveLookupResultSelect")}
              <select value={selectedFigi ?? ""} onChange={(event) => setSelectedFigi(event.target.value)}>
                {filteredHits.map((hit) => (
                  <option key={hit.figi} value={hit.figi}>
                    {hit.name} ({hit.exchCode || "N/A"}:{hit.ticker}, {displayCurrency(hit)})
                  </option>
                ))}
              </select>
            </label>
          )}

          {(selectedHit || directSymbol) && (
            <>
              <p className="live-chart-selection-label">
                {selectedHit ? (
                  <>
                    <strong>{selectedHit.name}</strong> · {t(language, "editAssetThExchange")} <code>{selectedHit.exchCode || "N/A"}</code> · Ticker{" "}
                    <code>{selectedHit.ticker}</code> · {t(language, "currencyCol")} <code>{displayCurrency(selectedHit)}</code>
                  </>
                ) : (
                  <>
                    <strong>{t(language, "liveLookupDirectTicker")}</strong> · <code>{normalizedQuery}</code>
                  </>
                )}
              </p>
              {selectedSymbol ? (
                <TradingViewLiveChart symbol={selectedSymbol} theme={chartTheme} height={420} />
              ) : (
                <p className="live-chart-empty">{t(language, "liveLookupNoChartSymbol")}</p>
              )}
            </>
          )}
        </div>
      )}

      {!loading && normalizedQuery && filteredHits.length === 0 && !directSymbol && !error && (
        <div className="card">
          <p className="live-chart-empty">{t(language, "liveLookupNoResults")}</p>
        </div>
      )}
    </section>
  );
}
