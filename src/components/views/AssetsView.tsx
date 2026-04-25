import { Database, Plus } from "lucide-react";
import type { AssetSortField } from "../../app/types";
import { money } from "../../lib/analytics";
import type { AssetRow } from "../../app/types";
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
  filteredAssets: AssetRow[];
  onToggleAssetSort: (field: AssetSortField) => void;
  assetSortMarker: (field: AssetSortField) => string;
  onGoToNewTrade: () => void;
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
  onGoToNewTrade
}: AssetsViewProps) {
  return (
    <section className="section">
      <PageHeader
        title={
          <>
            <Database size={18} />
            Basiswerte / Assets
          </>
        }
        subtitle="Alle in den Daten vorhandenen Basiswerte mit Kennzahlen"
        actions={
          <button className="primary" onClick={onGoToNewTrade}>
            <Plus size={14} />
            Neuer Basiswert
          </button>
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
              <th>Waehrung</th>
              <th onClick={() => onToggleAssetSort("tradesCount")} className="sortable">
                # Trades{assetSortMarker("tradesCount")}
              </th>
              <th onClick={() => onToggleAssetSort("realizedPL")} className="sortable">
                Realisierter P&L{assetSortMarker("realizedPL")}
              </th>
              <th onClick={() => onToggleAssetSort("openCapital")} className="sortable">
                Offenes Kapital{assetSortMarker("openCapital")}
              </th>
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
                <td>-</td>
                <td>-</td>
                <td>EUR</td>
                <td>{asset.tradesCount}</td>
                <td className={asset.realizedPL >= 0 ? "positive" : "negative"}>{money(asset.realizedPL)}</td>
                <td>{asset.openCapital > 0 ? money(asset.openCapital) : "-"}</td>
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
