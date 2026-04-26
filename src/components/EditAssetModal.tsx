import { Fragment, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { AssetDisplayRow, AssetMeta } from "../app/types";
import { canonicalizeBasiswert, sameBasiswertBucket } from "../lib/basiswertCanonical";
import { assetToTradingViewSymbol } from "../lib/tradingViewSymbol";
import { searchSymbolsOpenFigi, suggestTickerUsFromHit, suggestTickerXetraFromHit, type OpenFigiSearchHit } from "../lib/openFigiSearch";
import { TradingViewLiveChart } from "./TradingViewLiveChart";

type AssignChoice = "" | "listing" | "kurz" | "xetraPrefix";

function SymbolSearchHitRow({ hit, onApply }: { hit: OpenFigiSearchHit; onApply: (ticker: string) => void }) {
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
        <td>{hit.exchCode ?? "—"}</td>
        <td className="symbol-hit-type">{hit.securityType2 ?? hit.securityType}</td>
        <td className="symbol-hit-vorschau">
          <div className="symbol-hit-vorschau-line">
            <span className="symbol-hit-vorschau-k">Listing</span>
            <code>{usVorschlag}</code>
          </div>
          <div className="symbol-hit-vorschau-line">
            <span className="symbol-hit-vorschau-k">Kürzel</span>
            <code>{kurz}</code>
            {xetraVorschlag ? <span className="symbol-hit-vorschau-note"> (passt zu Xetra)</span> : null}
          </div>
        </td>
      </tr>
      <tr className="symbol-hit-assign-row">
        <td colSpan={5}>
          <div className="symbol-hit-assign-bar">
            <label className="symbol-hit-assign-label">
              <span className="symbol-hit-assign-title">Ticker zuordnen</span>
              <select value={choice} onChange={(e) => setChoice(e.target.value as AssignChoice)}>
                <option value="">Zielfeld wählen …</option>
                <option value="listing">Ticker = Listing-Vorschlag ({usVorschlag})</option>
                <option value="kurz">Ticker = nur Kürzel ({kurz}) → App ergänzt XETR: (Xetra / TradingView)</option>
                <option value="xetraPrefix" disabled={!xetraMitPraefix}>
                  Ticker = {xetraMitPraefix || "—"} (Xetra explizit, TradingView)
                </option>
              </select>
            </label>
            <button type="button" className="primary slim symbol-hit-assign-btn" disabled={!choice} onClick={apply}>
              Übernehmen
            </button>
          </div>
        </td>
      </tr>
    </Fragment>
  );
}

interface EditAssetModalProps {
  asset: AssetDisplayRow;
  categoryOptions: string[];
  chartTheme: "dark" | "light";
  onClose: () => void;
  /** `renameFrom` = ursprünglicher Listenname, wenn sich der Basiswert-Name geändert hat (Trades werden mitgezogen). */
  onSave: (meta: AssetMeta, renameFrom?: string) => void;
}

export function EditAssetModal({ asset, categoryOptions, chartTheme, onClose, onSave }: EditAssetModalProps) {
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
    return [...s].sort((a, b) => a.localeCompare(b, "de"));
  }, [categoryOptions, asset.category]);

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
          setSearchError(e instanceof Error ? e.message : "Suche fehlgeschlagen (Netzwerk oder CORS).");
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 400);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [symbolQuery]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert("Der Basiswert-Name darf nicht leer sein.");
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
          <h2 id="edit-asset-title">Basiswert bearbeiten</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="edit-asset-form-grid edit-asset-form-grid-ticker">
          <label className="edit-asset-ticker-fullwidth">
            Basiswert (Name)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Rheinmetall, SAP …" autoComplete="off" />
            <small className="edit-asset-ticker-hint">
              Entspricht dem Feld <strong>Basiswert</strong> in den Trades. Wenn du den Namen änderst, werden alle passenden Trade-Zeilen und diese
              Metadaten-Zeile mitgeführt (gleiche Dubletten-Logik wie beim Zusammenführen).
            </small>
          </label>
          <label>
            Kategorie
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {catSelectOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Währung
            <select value={waehrung} onChange={(e) => setWaehrung(e.target.value)}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CHF">CHF</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label className="edit-asset-ticker-fullwidth">
            Ticker (ein Feld)
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="z. B. SAP, NYSE:JPM, NASDAQ:AAPL, XETR:RHM …" autoComplete="off" />
            <small className="edit-asset-ticker-hint">
              <strong>Google Finance vs. Kürzel:</strong> Dort steht z. B. „NYSE: TSM“ für TSMC — im Ticker-Feld dann <code>NYSE:TSM</code> oder kurz <code>TSM</code> (wird auf NYSE:TSM gemappt). Der Name „TSMC“ ist <em>kein</em> Börsenkürzel; OpenFIGI sucht besser nach <code>TSM</code>, „Taiwan Semiconductor“ oder du wählst den NYSE‑Treffer.
              <br />
              Mit Börse (<code>NYSE:…</code>, <code>NASDAQ:…</code>) bist du am sichersten; nur Kürzel ohne Treffer in der Liste → <code>XETR:</code> (Xetra bei TradingView; älteres <code>XETRA:</code> wird für Charts automatisch umgewandelt).
            </small>
          </label>
        </div>

        <div className="edit-asset-search card nested-card">
          <h3>
            <Search size={16} aria-hidden />
            Ticker suchen (OpenFIGI)
          </h3>
          <p className="edit-asset-search-hint">
            Suchbegriff eingeben — bei ADRs oft das <strong>NYSE-/Nasdaq-Kürzel</strong> (z. B. <code>TSM</code>), nicht der deutsche Firmenname. Pro Treffer: <strong>Listing</strong> = US/ADR-Vorschlag, <strong>Kürzel</strong> = Rohkürzel. Dropdown + <strong>Übernehmen</strong>.
          </p>
          <label className="edit-asset-search-input-wrap">
            <span className="sr-only">Suchbegriff</span>
            <input value={symbolQuery} onChange={(e) => setSymbolQuery(e.target.value)} placeholder="z. B. SAP, Apple, Siemens …" autoComplete="off" />
          </label>
          {searchLoading && <p className="muted-inline">Suche …</p>}
          {searchError && <p className="edit-asset-search-error">{searchError}</p>}
          {hits.length > 0 && (
            <div className="symbol-hit-table-wrap">
              <table className="symbol-hit-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kürzel</th>
                    <th>Börse</th>
                    <th>Typ</th>
                    <th>Vorschau</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map((h) => (
                    <SymbolSearchHitRow key={`${h.figi}-${h.exchCode ?? ""}-${h.ticker}`} hit={h} onApply={(v) => setTicker(v)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {previewSymbol && (
          <div className="edit-asset-preview">
            <h3>Vorschau Live-Chart</h3>
            <TradingViewLiveChart symbol={previewSymbol} theme={chartTheme} height={320} />
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
