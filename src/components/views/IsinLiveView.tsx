import { useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { t } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import { TradingViewLiveChart } from "../TradingViewLiveChart";
import { searchByIsinOpenFigi, searchByWknOpenFigi, searchSymbolsOpenFigi, type OpenFigiSearchHit } from "../../lib/openFigiSearch";
import { resolvePlainTickerForTradingView } from "../../data/tickerTradingViewAliases";

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

  const normalizedQuery = queryInput.trim().toUpperCase();
  const isValidIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalizedQuery);
  const looksLikeWkn = /^[A-HJ-NPR-Z0-9]{6}$/.test(normalizedQuery);
  const looksLikeTicker = /^[A-Z0-9._-]{1,15}(:[A-Z0-9._-]{1,20})?$/.test(normalizedQuery);
  const looksLikeDerivativeText = /(LONG|SHORT|TURBO|KNOCK|KO|CALL|PUT|HEBEL|ZERTIFIKAT|WARRANT)/i.test(normalizedQuery);

  const selectedHit = useMemo(
    () => (selectedFigi ? hits.find((hit) => hit.figi === selectedFigi) ?? null : hits[0] ?? null),
    [hits, selectedFigi]
  );
  const selectedSymbol = directSymbol || (selectedHit ? resolvePlainTickerForTradingView(selectedHit.ticker) : null);
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
  const hsbcPriorityUrl = useMemo(() => {
    if (!normalizedQuery) return null;
    if (!isValidIsin && !looksLikeWkn) return null;
    return `https://www.hsbc-zertifikate.de/home/suche?suchbegriff=${encodeURIComponent(normalizedQuery)}`;
  }, [normalizedQuery, isValidIsin, looksLikeWkn]);

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
      if (looksLikeTicker) {
        const symbol = resolvePlainTickerForTradingView(normalizedQuery);
        if (symbol) {
          setDirectSymbol(symbol);
          setHits([]);
          return;
        }
      }
      const nextHits = await searchSymbolsOpenFigi(normalizedQuery);
      setHits(nextHits);
      if (nextHits.length > 0) setSelectedFigi(nextHits[0].figi);
    } catch {
      setError(t(language, "liveLookupError"));
    } finally {
      setLoading(false);
    }
  };

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
              onChange={(event) => setQueryInput(event.target.value.toUpperCase())}
              placeholder={t(language, "liveLookupInputPlaceholder")}
            />
          </label>
          <button className="primary" onClick={() => void runSearch()} disabled={!normalizedQuery || loading}>
            <Search size={14} />
            {loading ? t(language, "editAssetSearching") : t(language, "liveLookupSearchBtn")}
          </button>
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
      </div>

      {(hits.length > 0 || directSymbol) && (
        <div className="card isin-results-card">
          {hits.length > 1 && (
            <label className="live-chart-select-label">
              {t(language, "liveLookupResultSelect")}
              <select value={selectedFigi ?? ""} onChange={(event) => setSelectedFigi(event.target.value)}>
                {hits.map((hit) => (
                  <option key={hit.figi} value={hit.figi}>
                    {hit.name} ({hit.exchCode || "N/A"}:{hit.ticker})
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
                    <code>{selectedHit.ticker}</code>
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

      {!loading && normalizedQuery && hits.length === 0 && !directSymbol && !error && (
        <div className="card">
          <p className="live-chart-empty">{t(language, "liveLookupNoResults")}</p>
        </div>
      )}
    </section>
  );
}
