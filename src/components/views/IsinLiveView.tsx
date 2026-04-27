import { useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { t } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import { TradingViewLiveChart } from "../TradingViewLiveChart";
import { searchByIsinOpenFigi, type OpenFigiIsinHit } from "../../lib/openFigiSearch";
import { resolvePlainTickerForTradingView } from "../../data/tickerTradingViewAliases";

interface IsinLiveViewProps {
  language: AppSettings["language"];
  chartTheme: "dark" | "light";
}

export function IsinLiveView({ language, chartTheme }: IsinLiveViewProps) {
  const [isinInput, setIsinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<OpenFigiIsinHit[]>([]);
  const [selectedFigi, setSelectedFigi] = useState<string | null>(null);

  const normalizedIsin = isinInput.trim().toUpperCase();
  const isValidIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalizedIsin);

  const selectedHit = useMemo(
    () => (selectedFigi ? hits.find((hit) => hit.figi === selectedFigi) ?? null : hits[0] ?? null),
    [hits, selectedFigi]
  );
  const selectedSymbol = selectedHit ? resolvePlainTickerForTradingView(selectedHit.ticker) : null;

  const runSearch = async () => {
    if (!isValidIsin) return;
    setLoading(true);
    setError(null);
    setHits([]);
    setSelectedFigi(null);
    try {
      const nextHits = await searchByIsinOpenFigi(normalizedIsin);
      setHits(nextHits);
      if (nextHits.length > 0) setSelectedFigi(nextHits[0].figi);
    } catch {
      setError(t(language, "isinLookupError"));
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
            {t(language, "isinPageTitle")}
          </h2>
          <p>{t(language, "isinPageSubtitle")}</p>
        </div>
      </div>

      <div className="card isin-live-card">
        <div className="isin-search-row">
          <label className="isin-search-label" htmlFor="isin-input">
            {t(language, "isinInputLabel")}
            <input
              id="isin-input"
              value={isinInput}
              onChange={(event) => setIsinInput(event.target.value.toUpperCase())}
              placeholder={t(language, "isinInputPlaceholder")}
            />
          </label>
          <button className="primary" onClick={() => void runSearch()} disabled={!isValidIsin || loading}>
            <Search size={14} />
            {loading ? t(language, "editAssetSearching") : t(language, "isinSearchBtn")}
          </button>
        </div>
        {!isValidIsin && normalizedIsin.length > 0 && <p className="live-chart-empty">{t(language, "isinInvalidHint")}</p>}
        {error && <p className="edit-asset-search-error">{error}</p>}
      </div>

      {hits.length > 0 && (
        <div className="card isin-results-card">
          {hits.length > 1 && (
            <label className="live-chart-select-label">
              {t(language, "isinResultSelect")}
              <select value={selectedFigi ?? ""} onChange={(event) => setSelectedFigi(event.target.value)}>
                {hits.map((hit) => (
                  <option key={hit.figi} value={hit.figi}>
                    {hit.name} ({hit.exchCode || "N/A"}:{hit.ticker})
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedHit && (
            <>
              <p className="live-chart-selection-label">
                <strong>{selectedHit.name}</strong> · {t(language, "isinLabel")} <code>{normalizedIsin}</code> · {t(language, "editAssetThExchange")}{" "}
                <code>{selectedHit.exchCode || "N/A"}</code> · Ticker <code>{selectedHit.ticker}</code>
              </p>
              {selectedSymbol ? (
                <TradingViewLiveChart symbol={selectedSymbol} theme={chartTheme} height={420} />
              ) : (
                <p className="live-chart-empty">{t(language, "isinNoChartSymbol")}</p>
              )}
            </>
          )}
        </div>
      )}

      {!loading && isValidIsin && hits.length === 0 && !error && (
        <div className="card">
          <p className="live-chart-empty">{t(language, "isinNoResults")}</p>
        </div>
      )}
    </section>
  );
}
