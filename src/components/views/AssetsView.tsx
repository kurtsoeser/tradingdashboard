import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, Database, ExternalLink, FileDown, FileSpreadsheet, Pencil, Plus, Upload } from "lucide-react";
import { t } from "../../app/i18n";
import type { AssetDisplayRow, AssetMeta, AssetSortField } from "../../app/types";
import { money } from "../../lib/analytics";
import type { AppSettings } from "../../app/settings";
import { assetToTradingViewSymbol } from "../../lib/tradingViewSymbol";
import { TradingViewLiveChart } from "../TradingViewLiveChart";
import { EditAssetModal } from "../EditAssetModal";
import { PageHeader } from "../PageHeader";

interface AssetsViewProps {
  language: AppSettings["language"];
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
  chartTheme: "dark" | "light";
  onSaveAssetMeta: (meta: AssetMeta, renameFrom?: string) => void;
}

export function AssetsView({
  language,
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
  financeService,
  chartTheme,
  onSaveAssetMeta
}: AssetsViewProps) {
  /** Basiswert-Zeile, für die das Live-Chart angezeigt wird (Tabellenklick, erneuter Klick schließt). */
  const [chartAssetName, setChartAssetName] = useState<string | null>(null);
  const chartExpandRowRef = useRef<HTMLTableRowElement | null>(null);

  const selectedChartAsset = useMemo(
    () => (chartAssetName ? filteredAssets.find((a) => a.name === chartAssetName) ?? null : null),
    [chartAssetName, filteredAssets]
  );

  const selectedChartTvSymbol = selectedChartAsset ? assetToTradingViewSymbol(selectedChartAsset) : null;

  useEffect(() => {
    if (!chartAssetName) return;
    if (!filteredAssets.some((a) => a.name === chartAssetName)) {
      setChartAssetName(null);
    }
  }, [filteredAssets, chartAssetName]);

  useLayoutEffect(() => {
    if (!chartAssetName) return;
    chartExpandRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [chartAssetName]);

  const [editAsset, setEditAsset] = useState<AssetDisplayRow | null>(null);

  const categoryOptionsForEdit = useMemo(() => assetCategories.filter((c) => c !== "Alle"), [assetCategories]);

  const toFinanceUrl = (asset: AssetDisplayRow) => {
    const tick = asset.ticker?.trim();
    const fallback = asset.name.trim();
    const symbol = tick?.replace(/^[^:]+:\s*/, "") || tick || fallback;
    switch (financeService) {
      case "yahoo": {
        return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
      }
      case "tradingview": {
        const tv = assetToTradingViewSymbol(asset);
        return `https://www.tradingview.com/symbols/${encodeURIComponent(tv ?? symbol)}`;
      }
      case "investing": {
        return `https://www.investing.com/search/?q=${encodeURIComponent(symbol)}`;
      }
      case "google":
      default: {
        return `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}`;
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

  return (
    <section className="section">
      {editAsset && (
        <EditAssetModal
          key={editAsset.name}
          asset={editAsset}
          language={language}
          categoryOptions={categoryOptionsForEdit}
          chartTheme={chartTheme}
          onClose={() => setEditAsset(null)}
          onSave={(meta, renameFrom) => {
            onSaveAssetMeta(meta, renameFrom);
            setEditAsset(null);
          }}
        />
      )}
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
            {t(language, "assetsPageTitle")}
          </>
        }
        subtitle={t(language, "assetsPageSubtitle")}
        actions={
          <>
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                {t(language, "import")}
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <label htmlFor="assets-import-input" className="actions-dropdown-item file-pick-btn">
                  <span className="actions-dropdown-item-content">
                    <Upload size={14} />
                    {t(language, "importFile")}
                  </span>
                  <small>{t(language, "importFileHint")}</small>
                </label>
                <button className="actions-dropdown-item" onClick={onDownloadAssetTemplateCsv}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(language, "templateCsv")}
                  </span>
                  <small>{t(language, "templateCsvHint")}</small>
                </button>
                <button className="actions-dropdown-item" onClick={onDownloadAssetTemplateExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(language, "templateExcel")}
                  </span>
                  <small>{t(language, "templateExcelHint")}</small>
                </button>
              </div>
            </details>
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                {t(language, "export")}
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <button className="actions-dropdown-item" onClick={onExportAssetsCsv}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(language, "assetsExportCsv")}
                  </span>
                  <small>{t(language, "assetsExportCsvHint")}</small>
                </button>
                <button className="actions-dropdown-item" onClick={onExportAssetsExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(language, "assetsExportExcel")}
                  </span>
                  <small>{t(language, "assetsExportExcelHint")}</small>
                </button>
              </div>
            </details>
            <button className="primary" onClick={onGoToNewTrade}>
              <Plus size={14} />
              {t(language, "newAsset")}
            </button>
          </>
        }
      />

      <div className="trades-summary-grid">
        <div className="card">
          <h3>{t(language, "assetsTotal")}</h3>
          <div className="value">{assetSummary.totalAssets}</div>
        </div>
        <div className="card">
          <h3>{t(language, "assetsWithOpen")}</h3>
          <div className="value">{assetSummary.withOpen}</div>
        </div>
        <div className="card">
          <h3>{t(language, "realizedPL")}</h3>
          <div className={`value ${assetSummary.totalPL >= 0 ? "positive" : "negative"}`}>{money(assetSummary.totalPL)}</div>
        </div>
        <div className="card assets-category-card">
          <h3>{t(language, "byCategory")}</h3>
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
            {t(language, "search")}
            <input value={assetSearch} onChange={(event) => onAssetSearchChange(event.target.value)} placeholder={t(language, "assetSearchPlaceholder")} />
          </label>
          <label>
            {t(language, "category")}
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
        <h3>{t(language, "allAssetsTitle", { n: filteredAssets.length })}</h3>
        <p className="live-chart-table-hint">{t(language, "assetsRowHint")}</p>
        <table className="assets-table-selectable">
          <thead>
            <tr>
              <th onClick={() => onToggleAssetSort("name")} className="sortable">
                {t(language, "name")}
                {assetSortMarker("name")}
              </th>
              <th onClick={() => onToggleAssetSort("category")} className="sortable">
                {t(language, "category")}
                {assetSortMarker("category")}
              </th>
              <th>Ticker</th>
              <th>{t(language, "currencyCol")}</th>
              <th onClick={() => onToggleAssetSort("tradesCount")} className="sortable">
                {t(language, "hashTrades")}
                {assetSortMarker("tradesCount")}
              </th>
              <th onClick={() => onToggleAssetSort("realizedPL")} className="sortable">
                {t(language, "realizedPL")}
                {assetSortMarker("realizedPL")}
              </th>
              <th onClick={() => onToggleAssetSort("openCapital")} className="sortable">
                {t(language, "openCapital")}
                {assetSortMarker("openCapital")}
              </th>
              <th className="finance-col">{financeServiceLabel}</th>
              <th className="action-col">{t(language, "action")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset, rowIdx) => (
              <Fragment key={asset.name}>
                <tr
                  className={[
                    rowIdx % 2 === 1 ? "asset-row-zebra" : "",
                    chartAssetName === asset.name ? "asset-row-chart-selected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  onClick={() => setChartAssetName((prev) => (prev === asset.name ? null : asset.name))}
                >
                  <td>{asset.name}</td>
                  <td>
                    <span className="asset-badge">{asset.category}</span>
                  </td>
                  <td>{asset.ticker || "-"}</td>
                  <td>{asset.waehrung || "EUR"}</td>
                  <td>{asset.tradesCount}</td>
                  <td className={asset.realizedPL >= 0 ? "positive" : "negative"}>{money(asset.realizedPL)}</td>
                  <td>{asset.openCapital > 0 ? money(asset.openCapital) : "-"}</td>
                  <td className="finance-col" onClick={(e) => e.stopPropagation()}>
                    <a
                      className="secondary slim finance-link-btn icon-only"
                      href={toFinanceUrl(asset)}
                      target="_blank"
                      rel="noreferrer"
                      title={t(language, "financeOpen", { svc: financeServiceLabel })}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </td>
                  <td className="action-col" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="icon-btn action edit" title={t(language, "edit")} onClick={() => setEditAsset(asset)}>
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
                {chartAssetName === asset.name && (
                  <tr ref={chartExpandRowRef} className="asset-chart-expand-row">
                    <td colSpan={9}>
                      <div className="asset-chart-expand-inner">
                        <h4 className="live-chart-title asset-chart-expand-title">
                          <Activity size={16} aria-hidden />
                          {t(language, "liveChart")}
                        </h4>
                        <p className="live-chart-hint live-chart-hint-compact">{t(language, "liveChartHint")}</p>
                        {selectedChartAsset && !selectedChartTvSymbol && (
                          <p className="live-chart-empty">{t(language, "noTickerHint", { name: selectedChartAsset.name })}</p>
                        )}
                        {selectedChartAsset && selectedChartTvSymbol && (
                          <>
                            <p className="live-chart-selection-label">
                              <strong>{selectedChartAsset.name}</strong> · <code>{selectedChartTvSymbol}</code>
                            </p>
                            <TradingViewLiveChart symbol={selectedChartTvSymbol} theme={chartTheme} height={380} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
