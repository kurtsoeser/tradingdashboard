import { Fragment, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import type { AssetDisplayRow, AssetMeta } from "../app/types";
import { canonicalizeBasiswert, sameBasiswertBucket } from "../lib/basiswertCanonical";
import { assetToTradingViewSymbol } from "../lib/tradingViewSymbol";
import { searchSymbolsOpenFigi, suggestTickerUsFromHit, suggestTickerXetraFromHit, type OpenFigiSearchHit } from "../lib/openFigiSearch";
import { TradingViewLiveChart } from "./TradingViewLiveChart";

type AssignChoice = "" | "listing" | "kurz" | "xetraPrefix";

function SymbolSearchHitRow({
  hit,
  language,
  onApply
}: {
  hit: OpenFigiSearchHit;
  language: AppSettings["language"];
  onApply: (ticker: string) => void;
}) {
  const usVorschlag = suggestTickerUsFromHit(hit);
  const xetraVorschlag = suggestTickerXetraFromHit(hit);
  const kurz = hit.ticker.trim();
  const xetraMitPraefix = kurz ? `XETR:${kurz.toUpperCase()}` : "";
  const [choice, setChoice] = useState<AssignChoice>("");

  const apply = () => {
    switch (choice) {
      case "listing":
        onApply(usVorschlag);
        break;
      case "kurz":
        onApply(kurz);
        break;
      case "xetraPrefix":
        if (xetraMitPraefix) onApply(xetraMitPraefix);
        break;
      default:
        return;
    }
    setChoice("");
  };

  return (
    <Fragment>
      <tr className="symbol-hit-main-row">
        <td className="symbol-hit-name">{hit.name}</td>
        <td>
          <code>{hit.ticker}</code>
        </td>
        <td>{hit.exchCode ?? t(language, "noneDash")}</td>
        <td className="symbol-hit-type">{hit.securityType2 ?? hit.securityType}</td>
        <td className="symbol-hit-vorschau">
          <div className="symbol-hit-vorschau-line">
            <span className="symbol-hit-vorschau-k">{t(language, "editAssetListing")}</span>
            <code>{usVorschlag}</code>
          </div>
          <div className="symbol-hit-vorschau-line">
            <span className="symbol-hit-vorschau-k">{t(language, "editAssetSymbolShort")}</span>
            <code>{kurz}</code>
            {xetraVorschlag ? <span className="symbol-hit-vorschau-note"> {t(language, "editAssetXetraNote")}</span> : null}
          </div>
        </td>
      </tr>
      <tr className="symbol-hit-assign-row">
        <td colSpan={5}>
          <div className="symbol-hit-assign-bar">
            <label className="symbol-hit-assign-label">
              <span className="symbol-hit-assign-title">{t(language, "editAssetAssignTicker")}</span>
              <select value={choice} onChange={(e) => setChoice(e.target.value as AssignChoice)}>
                <option value="">{t(language, "editAssetSelectTarget")}</option>
                <option value="listing">{t(language, "editAssetOptListing", { s: usVorschlag })}</option>
                <option value="kurz">{t(language, "editAssetOptShort", { s: kurz })}</option>
                <option value="xetraPrefix" disabled={!xetraMitPraefix}>
                  {t(language, "editAssetOptXetra", { s: xetraMitPraefix || t(language, "noneDash") })}
                </option>
              </select>
            </label>
            <button type="button" className="primary slim symbol-hit-assign-btn" disabled={!choice} onClick={apply}>
              {t(language, "apply")}
            </button>
          </div>
        </td>
      </tr>
    </Fragment>
  );
}

interface EditAssetModalProps {
  asset: AssetDisplayRow;
  language: AppSettings["language"];
  categoryOptions: string[];
  chartTheme: "dark" | "light";
  onClose: () => void;
  /** `renameFrom` = ursprünglicher Listenname, wenn sich der Basiswert-Name geändert hat (Trades werden mitgezogen). */
  onSave: (meta: AssetMeta, renameFrom?: string) => void;
}

export function EditAssetModal({ asset, language, categoryOptions, chartTheme, onClose, onSave }: EditAssetModalProps) {
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState(asset.category);
  const [ticker, setTicker] = useState(asset.ticker ?? "");
  const [waehrung, setWaehrung] = useState(asset.waehrung ?? "EUR");

  const [symbolQuery, setSymbolQuery] = useState("");
  const [hits, setHits] = useState<OpenFigiSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const previewRow = useMemo(
    () => ({
      ...asset,
      name: name.trim() || asset.name,
      category,
      ticker: ticker || undefined,
      waehrung: waehrung || undefined
    }),
    [asset, name, category, ticker, waehrung]
  );

  const previewSymbol = assetToTradingViewSymbol(previewRow);

  const catSelectOptions = useMemo(() => {
    const s = new Set(categoryOptions);
    s.add(asset.category);
    return [...s].sort((a, b) => a.localeCompare(b, language === "en" ? "en" : "de"));
  }, [categoryOptions, asset.category, language]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const q = symbolQuery.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchError(null);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setSearchError(null);
        try {
          const data = await searchSymbolsOpenFigi(q, ac.signal);
          setHits(data);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setHits([]);
          setSearchError(e instanceof Error ? e.message : t(language, "editAssetSearchFailed"));
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 400);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [symbolQuery, language]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert(t(language, "basiswertEmpty"));
      return;
    }
    const canon = canonicalizeBasiswert(trimmed);
    const nameChanged = !sameBasiswertBucket(asset.name, trimmed);
    onSave(
      {
        name: canon,
        category: category.trim() || undefined,
        ticker: ticker.trim() || undefined,
        waehrung: waehrung.trim() || undefined
      },
      nameChanged ? asset.name : undefined
    );
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog edit-asset-modal" role="dialog" aria-modal="true" aria-labelledby="edit-asset-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="edit-asset-title">{t(language, "editAssetTitle")}</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label={t(language, "modalCloseAria")}>
            <X size={18} />
          </button>
        </div>

        <div className="edit-asset-form-grid edit-asset-form-grid-ticker">
          <label className="edit-asset-ticker-fullwidth">
            {t(language, "editAssetBasiswertName")}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(language, "editAssetNamePlaceholder")} autoComplete="off" />
            <small className="edit-asset-ticker-hint">{t(language, "editAssetNameHint")}</small>
          </label>
          <label>
            {t(language, "category")}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {catSelectOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(language, "currencyCol")}
            <select value={waehrung} onChange={(e) => setWaehrung(e.target.value)}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CHF">CHF</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label className="edit-asset-ticker-fullwidth">
            {t(language, "editAssetTickerOneField")}
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder={t(language, "editAssetTickerPlaceholder")} autoComplete="off" />
            <small className="edit-asset-ticker-hint">{t(language, "editAssetTickerHint")}</small>
          </label>
        </div>

        <div className="edit-asset-search card nested-card">
          <h3>
            <Search size={16} aria-hidden />
            {t(language, "editAssetSearchTitle")}
          </h3>
          <p className="edit-asset-search-hint">{t(language, "editAssetSearchHint")}</p>
          <label className="edit-asset-search-input-wrap">
            <span className="sr-only">{t(language, "searchQueryAria")}</span>
            <input value={symbolQuery} onChange={(e) => setSymbolQuery(e.target.value)} placeholder={t(language, "editAssetSymbolQueryPlaceholder")} autoComplete="off" />
          </label>
          {searchLoading && <p className="muted-inline">{t(language, "editAssetSearching")}</p>}
          {searchError && <p className="edit-asset-search-error">{searchError}</p>}
          {hits.length > 0 && (
            <div className="symbol-hit-table-wrap">
              <table className="symbol-hit-table">
                <thead>
                  <tr>
                    <th>{t(language, "name")}</th>
                    <th>{t(language, "editAssetThSymbol")}</th>
                    <th>{t(language, "editAssetThExchange")}</th>
                    <th>{t(language, "type")}</th>
                    <th>{t(language, "editAssetThPreview")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map((h) => (
                    <SymbolSearchHitRow key={`${h.figi}-${h.exchCode ?? ""}-${h.ticker}`} hit={h} language={language} onApply={(v) => setTicker(v)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {previewSymbol && (
          <div className="edit-asset-preview">
            <h3>{t(language, "editAssetPreviewChart")}</h3>
            <TradingViewLiveChart symbol={previewSymbol} theme={chartTheme} height={320} />
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            {t(language, "save")}
          </button>
        </div>
      </div>
    </div>
  );
}
