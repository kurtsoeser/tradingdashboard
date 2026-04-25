import { ChevronDown, Database, ExternalLink, FileDown, FileSpreadsheet, Plus, Upload } from "lucide-react";
import type { AssetSortField } from "../../app/types";
import { money } from "../../lib/analytics";
import type { AssetDisplayRow } from "../../app/types";
import type { AppSettings } from "../../app/settings";
import { PageHeader } from "../PageHeader";

interface AssetsViewProps {
  assetSummary: {
    totalAssets: number;
    withOpen: number;
    totalPL: number;
    categoryCount: Record<string, number>;
  };
  assetSearch: string;
  onAssetSearchChange: (value: string) => void;
  assetCategoryFilter: string;
  onAssetCategoryFilterChange: (value: string) => void;
  assetCategories: string[];
  filteredAssets: AssetDisplayRow[];
  onToggleAssetSort: (field: AssetSortField) => void;
  assetSortMarker: (field: AssetSortField) => string;
  onImportAssetsFile: (file: File) => Promise<void>;
  onDownloadAssetTemplateCsv: () => void;
  onDownloadAssetTemplateExcel: () => void;
  onExportAssetsCsv: () => void;
  onExportAssetsExcel: () => void;
  onGoToNewTrade: () => void;
  financeService: AppSettings["financeService"];
}

export function AssetsView({
  assetSummary,
  assetSearch,
  onAssetSearchChange,
  assetCategoryFilter,
  onAssetCategoryFilterChange,
  assetCategories,
  filteredAssets,
  onToggleAssetSort,
  assetSortMarker,
  onImportAssetsFile,
  onDownloadAssetTemplateCsv,
  onDownloadAssetTemplateExcel,
  onExportAssetsCsv,
  onExportAssetsExcel,
  onGoToNewTrade,
  financeService
}: AssetsViewProps) {
  const toFinanceUrl = (asset: AssetDisplayRow) => {
    const tickerUs = asset.tickerUs?.trim();
    const tickerXetra = asset.tickerXetra?.trim();
    const fallback = asset.name.trim();
    switch (financeService) {
      case "yahoo": {
        const symbol = tickerUs || tickerXetra || fallback;
        return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
      }
      case "tradingview": {
        const symbol = tickerUs || tickerXetra || fallback;
        return `https://www.tradingview.com/symbols/${encodeURIComponent(symbol)}`;
      }
      case "investing": {
        const query = tickerUs || tickerXetra || fallback;
        return `https://www.investing.com/search/?q=${encodeURIComponent(query)}`;
      }
      case "google":
      default: {
        const query = tickerUs || tickerXetra || fallback;
        return `https://www.google.com/finance/quote/${encodeURIComponent(query)}`;
      }
    }
  };

  const financeServiceLabel = (() => {
    switch (financeService) {
      case "yahoo":
        return "Yahoo Finance";
      case "tradingview":
        return "TradingView";
      case "investing":
        return "Investing.com";
      case "google":
      default:
        return "Google Finance";
    }
  })();

  const financeOpenLabel = (() => {
    switch (financeService) {
      case "yahoo":
        return "Bei Yahoo öffnen";
      case "tradingview":
        return "Bei TradingView öffnen";
      case "investing":
        return "Bei Investing öffnen";
      case "google":
      default:
        return "Bei Google öffnen";
    }
  })();

  return (
    <section className="section">
      <input
        id="assets-import-input"
        type="file"
        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImportAssetsFile(file);
        }}
      />
      <PageHeader
        title={
          <>
            <Database size={18} />
            Basiswerte / Assets
          </>
        }
        subtitle="Alle in den Daten vorhandenen Basiswerte mit Kennzahlen"
        actions={
          <>
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                Import
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <label htmlFor="assets-import-input" className="actions-dropdown-item file-pick-btn">
                  <span className="actions-dropdown-item-content">
                    <Upload size={14} />
                    Datei importieren
                  </span>
                  <small>CSV oder Excel Datei laden</small>
                </label>
                <button className="actions-dropdown-item" onClick={onDownloadAssetTemplateCsv}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    Vorlage CSV herunterladen
                  </span>
                  <small>Beispielspalten für CSV</small>
                </button>
                <button className="actions-dropdown-item" onClick={onDownloadAssetTemplateExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    Vorlage Excel herunterladen
                  </span>
                  <small>Beispielspalten für Excel</small>
                </button>
              </div>
            </details>
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                Export
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <button className="actions-dropdown-item" onClick={onExportAssetsCsv}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    Basiswerte als CSV exportieren
                  </span>
                  <small>Mit Kennzahlen und Tickern</small>
                </button>
                <button className="actions-dropdown-item" onClick={onExportAssetsExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    Basiswerte als Excel exportieren
                  </span>
                  <small>Mit Kennzahlen und Tickern</small>
                </button>
              </div>
            </details>
            <button className="primary" onClick={onGoToNewTrade}>
              <Plus size={14} />
              Neuer Basiswert
            </button>
          </>
        }
      />

      <div className="trades-summary-grid">
        <div className="card">
          <h3>Basiswerte gesamt</h3>
          <div className="value">{assetSummary.totalAssets}</div>
        </div>
        <div className="card">
          <h3>Mit offenen Positionen</h3>
          <div className="value">{assetSummary.withOpen}</div>
        </div>
        <div className="card">
          <h3>Realisierter P&L</h3>
          <div className={`value ${assetSummary.totalPL >= 0 ? "positive" : "negative"}`}>{money(assetSummary.totalPL)}</div>
        </div>
        <div className="card assets-category-card">
          <h3>Nach Kategorie</h3>
          <div className="assets-category-tags">
            {Object.entries(assetSummary.categoryCount).map(([category, count]) => (
              <span key={category}>
                {category}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card trades-filters-card">
        <div className="assets-filters-grid">
          <label>
            Suche
            <input value={assetSearch} onChange={(event) => onAssetSearchChange(event.target.value)} placeholder="Suche nach Name oder Ticker..." />
          </label>
          <label>
            Kategorie
            <select value={assetCategoryFilter} onChange={(event) => onAssetCategoryFilterChange(event.target.value)}>
              {assetCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Alle Basiswerte ({filteredAssets.length})</h3>
        <table>
          <thead>
            <tr>
              <th onClick={() => onToggleAssetSort("name")} className="sortable">
                Name{assetSortMarker("name")}
              </th>
              <th onClick={() => onToggleAssetSort("category")} className="sortable">
                Kategorie{assetSortMarker("category")}
              </th>
              <th>Ticker US</th>
              <th>Ticker Xetra</th>
              <th>Währung</th>
              <th onClick={() => onToggleAssetSort("tradesCount")} className="sortable">
                # Trades{assetSortMarker("tradesCount")}
              </th>
              <th onClick={() => onToggleAssetSort("realizedPL")} className="sortable">
                Realisierter P&L{assetSortMarker("realizedPL")}
              </th>
              <th onClick={() => onToggleAssetSort("openCapital")} className="sortable">
                Offenes Kapital{assetSortMarker("openCapital")}
              </th>
              <th>{financeServiceLabel}</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.name}>
                <td>{asset.name}</td>
                <td>
                  <span className="asset-badge">{asset.category}</span>
                </td>
                <td>{asset.tickerUs || "-"}</td>
                <td>{asset.tickerXetra || "-"}</td>
                <td>{asset.waehrung || "EUR"}</td>
                <td>{asset.tradesCount}</td>
                <td className={asset.realizedPL >= 0 ? "positive" : "negative"}>{money(asset.realizedPL)}</td>
                <td>{asset.openCapital > 0 ? money(asset.openCapital) : "-"}</td>
                <td>
                  <a className="secondary slim finance-link-btn" href={toFinanceUrl(asset)} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} />
                    {financeOpenLabel}
                  </a>
                </td>
                <td>
                  <button className="secondary slim">Bearbeiten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
