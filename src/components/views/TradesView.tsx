import { CheckCircle2, ChevronDown, Circle, CircleDollarSign, FileDown, FileJson, FileSpreadsheet, HandCoins, Layers, Pencil, Plus, Search, TrendingDown, TrendingUp, Upload, X, Briefcase } from "lucide-react";
import { t } from "../../app/i18n";
import { formatDateTimeAT } from "../../app/date";
import type { SortDirection, TradesSortField } from "../../app/types";
import type { AppSettings } from "../../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../../lib/analytics";
import type { Trade } from "../../types/trade";
import { PageHeader } from "../PageHeader";

interface TradesViewProps {
  filteredTrades: Trade[];
  trades: Trade[];
  kpis: {
    totalTrades: number;
    openTrades: number;
    openCapital: number;
    totalPL: number;
  };
  tradesSummary: { totalKauf: number; totalVerkauf: number; winners: number; losers: number };
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "Alle" | Trade["status"];
  onStatusFilterChange: (value: "Alle" | Trade["status"]) => void;
  typFilter: string;
  onTypFilterChange: (value: string) => void;
  basiswertFilter: string;
  onBasiswertFilterChange: (value: string) => void;
  rangeFilter: "Alle" | "7" | "30" | "90" | "365";
  onRangeFilterChange: (value: "Alle" | "7" | "30" | "90" | "365") => void;
  availableTypes: string[];
  availableBasiswerte: string[];
  sortMarker: (field: TradesSortField) => string;
  onToggleSort: (field: TradesSortField) => void;
  onImportTradesFile: (file: File) => Promise<void>;
  onDownloadImportTemplateCsv: () => void;
  onDownloadImportTemplateExcel: () => void;
  onExportTradesCsvForExcel: () => void;
  onExportTradesJsonBackup: () => void;
  onGoToNewTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  calendarMonthLabel: string;
  onCalendarPrevMonth: () => void;
  onCalendarNextMonth: () => void;
  onClearCalendarFilter: () => void;
  calendarCells: number[];
  currentCalendarYear: number;
  currentCalendarMonth: number;
  tradesCalendarMap: Map<string, Trade[]>;
  calendarRangeMin: string | null;
  calendarRangeMax: string | null;
  calendarRangeStart: string | null;
  calendarRangeEnd: string | null;
  onCalendarDayMouseDown: (dateKey: string) => void;
  onCalendarDayMouseEnter: (dateKey: string) => void;
  onCalendarMouseUp: () => void;
  calendarDragMoved: boolean;
  setCalendarDragMoved: React.Dispatch<React.SetStateAction<boolean>>;
  onSetSingleDayFilter: (dateKey: string) => void;
  calendarWeekdayNames: string[];
  language: AppSettings["language"];
}

export function TradesView(props: TradesViewProps) {
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

  return (
    <section className="section trades-page">
      <PageHeader
        title={
          <>
            <Search size={18} />
            {t(props.language, "tradesTitle")}
          </>
        }
        subtitle={t(props.language, "tradesSubtitle", { filtered: props.filteredTrades.length, total: props.trades.length })}
        actions={
          <>
            <input
              id="trades-import-input"
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void props.onImportTradesFile(file);
              }}
            />
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                {t(props.language, "import")}
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <label htmlFor="trades-import-input" className="actions-dropdown-item file-pick-btn">
                  <span className="actions-dropdown-item-content">
                    <Upload size={14} />
                    {t(props.language, "importFile")}
                  </span>
                  <small>{t(props.language, "importFileHint")}</small>
                </label>
                <button className="actions-dropdown-item" onClick={props.onDownloadImportTemplateCsv}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(props.language, "templateCsv")}
                  </span>
                  <small>{t(props.language, "templateCsvHint")}</small>
                </button>
                <button className="actions-dropdown-item" onClick={props.onDownloadImportTemplateExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(props.language, "templateExcel")}
                  </span>
                  <small>{t(props.language, "templateExcelHint")}</small>
                </button>
              </div>
            </details>
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                {t(props.language, "export")}
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <button className="actions-dropdown-item" onClick={props.onExportTradesCsvForExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(props.language, "csvExportExcel")}
                  </span>
                  <small>{t(props.language, "csvExportExcelHint")}</small>
                </button>
                <button className="actions-dropdown-item" onClick={props.onExportTradesJsonBackup}>
                  <span className="actions-dropdown-item-content">
                    <FileJson size={14} />
                    {t(props.language, "jsonBackup")}
                  </span>
                  <small>{t(props.language, "jsonBackupHint")}</small>
                </button>
              </div>
            </details>
            <button className="primary new-trade-cta" onClick={props.onGoToNewTrade}>
              <Plus size={14} />
              {t(props.language, "newTrade")}
            </button>
          </>
        }
      />

      <section className="kpis trades-kpis">
        <div className="card">
          <h3>
            <Briefcase size={14} />
            {t(props.language, "tradesTotal")}
          </h3>
          <div className="value">{props.kpis.totalTrades}</div>
        </div>
        <div className="card">
          <h3>
            <Layers size={14} />
            {t(props.language, "openPositions")}
          </h3>
          <div className="value">{props.kpis.openTrades}</div>
        </div>
        <div className="card">
          <h3>
            <TrendingUp size={14} />
            {t(props.language, "winners")}
          </h3>
          <div className="value positive">{props.tradesSummary.winners}</div>
        </div>
        <div className="card">
          <h3>
            <TrendingDown size={14} />
            {t(props.language, "losers")}
          </h3>
          <div className="value negative">{props.tradesSummary.losers}</div>
        </div>
      </section>

      <div className="trades-summary-grid trades-summary-grid-spaced">
        <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(props.language, "sigmaBuy")}
          </h3>
          <div className="value">{money(props.tradesSummary.totalKauf)}</div>
        </div>
        <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(props.language, "sigmaSell")}
          </h3>
          <div className="value">{money(props.tradesSummary.totalVerkauf)}</div>
        </div>
        <div className="card">
          <h3>
            <HandCoins size={14} />
            {t(props.language, "openCapital")}
          </h3>
          <div className="value">{money(props.kpis.openCapital)}</div>
        </div>
        <div className="card">
          <h3>
            <TrendingUp size={14} />
            {t(props.language, "realizedPL")}
          </h3>
          <div className={`value ${props.kpis.totalPL >= 0 ? "positive" : "negative"}`}>{money(props.kpis.totalPL)}</div>
        </div>
      </div>

      <div className="trades-controls-layout">
        <div className="trades-controls-main">
          {props.trades.length === 0 ? (
            <div className="card">
              <h3>{t(props.language, "importGuideTitle")}</h3>
              <p>{t(props.language, "importGuideP1")}</p>
              <p>{t(props.language, "importGuideP2")}</p>
              <p>{t(props.language, "importGuideP3")}</p>
            </div>
          ) : null}
          <div className="card trades-filters-card trades-filters-search-card">
            <label className="trades-single-search">
              <span className="label-with-icon">
                <Search size={13} />
                {t(props.language, "search")}
              </span>
              <input value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder={t(props.language, "searchPlaceholder")} />
            </label>
          </div>
          <div className="card trades-filters-card trades-filters-card-main">
            <div className="trades-filters-grid">
              <label>
                {t(props.language, "status")}
                <select value={props.statusFilter} onChange={(event) => props.onStatusFilterChange(event.target.value as "Alle" | Trade["status"])}>
                  <option value="Alle">{t(props.language, "all")}</option>
                  <option value="Offen">{t(props.language, "open")}</option>
                  <option value="Geschlossen">{t(props.language, "closed")}</option>
                </select>
              </label>
              <label>
                {t(props.language, "type")}
                <select value={props.typFilter} onChange={(event) => props.onTypFilterChange(event.target.value)}>
                  {props.availableTypes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(props.language, "basiswert")}
                <select value={props.basiswertFilter} onChange={(event) => props.onBasiswertFilterChange(event.target.value)}>
                  {props.availableBasiswerte.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(props.language, "range")}
                <select value={props.rangeFilter} onChange={(event) => props.onRangeFilterChange(event.target.value as "Alle" | "7" | "30" | "90" | "365")}>
                  <option value="Alle">{t(props.language, "all")}</option>
                  <option value="7">{t(props.language, "days7")}</option>
                  <option value="30">{t(props.language, "days30")}</option>
                  <option value="90">{t(props.language, "days90")}</option>
                  <option value="365">{t(props.language, "days365")}</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="card trades-inline-calendar-card" onMouseUp={props.onCalendarMouseUp} onMouseLeave={props.onCalendarMouseUp}>
          <div className="trades-inline-calendar-head">
            <button className="secondary slim" onClick={props.onCalendarPrevMonth}>
              ◀
            </button>
            <strong>{props.calendarMonthLabel}</strong>
            <button className="secondary slim" onClick={props.onCalendarNextMonth}>
              ▶
            </button>
            <button className="secondary slim" onClick={props.onClearCalendarFilter}>
              {t(props.language, "reset")}
            </button>
          </div>
          <div className="month-weekdays inline">
            {props.calendarWeekdayNames.map((weekday) => (
              <span key={`inline-${weekday}`}>{weekday}</span>
            ))}
          </div>
          <div className="month-days inline">
            {props.calendarCells.map((day, idx) => {
              if (day < 1) {
                return <div key={`inline-empty-${idx}`} className="day-cell empty" />;
              }
              const key = toDateKey(new Date(props.currentCalendarYear, props.currentCalendarMonth, day));
              const tradesForDay = props.tradesCalendarMap.get(key) ?? [];
              const inRange = !!(props.calendarRangeMin && props.calendarRangeMax && key >= props.calendarRangeMin && key <= props.calendarRangeMax);
              const isBoundary = key === props.calendarRangeStart || key === props.calendarRangeEnd;
              return (
                <button
                  key={`inline-${key}`}
                  type="button"
                  className={`day-cell inline ${inRange ? "in-range" : ""} ${isBoundary ? "range-boundary" : ""}`}
                  title={`${key}: ${tradesForDay.length} ${t(props.language, "navTrades")}`}
                  onMouseDown={() => props.onCalendarDayMouseDown(key)}
                  onMouseEnter={() => props.onCalendarDayMouseEnter(key)}
                  onMouseUp={props.onCalendarMouseUp}
                  onClick={() => {
                    if (props.calendarDragMoved) {
                      props.setCalendarDragMoved(false);
                      return;
                    }
                    props.onSetSingleDayFilter(key);
                  }}
                >
                  <span className="day-number">{day}</span>
                  <div className="day-icons">
                    {tradesForDay.slice(0, 4).map((trade) => (
                      <span key={`inline-icon-${trade.id}`} className={`day-trade-icon ${isTradeClosed(trade) ? "closed" : "open"}`} />
                    ))}
                    {tradesForDay.length > 4 ? <span className="day-more">+{tradesForDay.length - 4}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th onClick={() => props.onToggleSort("kauf")} className="sortable">
                {t(props.language, "buy")}
                {props.sortMarker("kauf")}
              </th>
              <th onClick={() => props.onToggleSort("verkauf")} className="sortable">
                {t(props.language, "sell")}
                {props.sortMarker("verkauf")}
              </th>
              <th onClick={() => props.onToggleSort("name")} className="sortable">
                {t(props.language, "name")}
                {props.sortMarker("name")}
              </th>
              <th onClick={() => props.onToggleSort("typ")} className="sortable">
                {t(props.language, "type")}
                {props.sortMarker("typ")}
              </th>
              <th>{t(props.language, "basiswert")}</th>
              <th>ISIN</th>
              <th onClick={() => props.onToggleSort("kaufPreis")} className="sortable">
                {t(props.language, "buyEur")}
                {props.sortMarker("kaufPreis")}
              </th>
              <th onClick={() => props.onToggleSort("verkaufPreis")} className="sortable">
                {t(props.language, "sellEur")}
                {props.sortMarker("verkaufPreis")}
              </th>
              <th onClick={() => props.onToggleSort("gewinn")} className="sortable">
                {t(props.language, "profit")}
                {props.sortMarker("gewinn")}
              </th>
              <th>{t(props.language, "pct")}</th>
              <th>{t(props.language, "action")}</th>
            </tr>
          </thead>
          <tbody>
            {props.filteredTrades.slice(0, 500).map((trade) => (
              <tr key={trade.id}>
                <td>{isTradeClosed(trade) ? <CheckCircle2 size={16} className="status-icon closed" /> : <Circle size={16} className="status-icon open" />}</td>
                <td>{formatDateTimeAT(trade.kaufzeitpunkt)}</td>
                <td>{formatDateTimeAT(trade.verkaufszeitpunkt)}</td>
                <td>{trade.name}</td>
                <td>{trade.typ}</td>
                <td>{trade.basiswert}</td>
                <td>{trade.isin || "-"}</td>
                <td>{money(trade.kaufPreis)}</td>
                <td>{trade.verkaufPreis ? money(trade.verkaufPreis) : "-"}</td>
                <td className={getTradeRealizedPL(trade) >= 0 ? "positive" : "negative"}>{money(getTradeRealizedPL(trade))}</td>
                <td>
                  {trade.kaufPreis > 0 && isTradeClosed(trade) ? (
                    <span className={(getTradeRealizedPL(trade) / trade.kaufPreis) * 100 >= 0 ? "positive" : "negative"}>
                      {`${((getTradeRealizedPL(trade) / trade.kaufPreis) * 100).toFixed(1)}%`}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="icon-btn action edit" title={t(props.language, "edit")} onClick={() => props.onEditTrade(trade)}>
                      <Pencil size={13} />
                    </button>
                    <button
                      className="icon-btn action delete"
                      title={t(props.language, "delete")}
                      onClick={() => props.onDeleteTrade(trade.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
