import {
  Briefcase,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  HandCoins,
  Layers,
  Search,
  TrendingDown,
  TrendingUp,
  Upload
} from "lucide-react";
import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
import { getCalendarMonthLabel, getWeekdayNames } from "../../app/date";
import { t, type I18nKey } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import type { SortDirection } from "../../app/types";
import { money } from "../../lib/analytics";
import type { FlatBookingRow } from "../../lib/flattenBookings";
import type { Trade, TradePositionBookingKind } from "../../types/trade";
import { BookingsImportPreviewModal } from "../BookingsImportPreviewModal";
import { PageHeader } from "../PageHeader";
import { runBookingsExcelImport } from "../../lib/bookingsFullExcelImport";

function kindLabel(language: AppSettings["language"], kind: TradePositionBookingKind): string {
  if (kind === "BUY") return t(language, "buy");
  if (kind === "SELL") return t(language, "sell");
  if (kind === "INCOME") return t(language, "incomeBooking");
  return t(language, "cloudBookingKindTaxCorr");
}

function bookingInstant(row: FlatBookingRow): Date | null {
  const ms = Date.parse(row.booking.bookedAtIso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalYmdKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function bookingYmdKey(row: FlatBookingRow): string | null {
  const d = bookingInstant(row);
  return d ? toLocalYmdKey(d) : null;
}

const KIND_SORT_ORDER: Record<TradePositionBookingKind, number> = {
  BUY: 0,
  SELL: 1,
  INCOME: 2,
  TAX_CORRECTION: 3
};

type BookingsSortField =
  | "when"
  | "kind"
  | "name"
  | "typ"
  | "basiswert"
  | "status"
  | "qty"
  | "unit"
  | "gross"
  | "fees"
  | "tax"
  | "leg";

interface BookingsViewProps {
  rows: FlatBookingRow[];
  trades: Trade[];
  language: AppSettings["language"];
  weekStartsOn: AppSettings["weekStartsOn"];
  onEditTrade: (trade: Trade) => void;
  onToggleTradeManualChecked: (tradeId: string, checked: boolean) => void;
  onExportBookingsFullExcel: () => void;
  onExportBookingsDbExcel: () => void;
  onCommitBookingsImport: (nextTrades: Trade[], info: { updatedTradeCount: number; rowCount: number }) => void;
}

export function BookingsView({
  rows,
  trades,
  language,
  weekStartsOn,
  onEditTrade,
  onToggleTradeManualChecked,
  onExportBookingsFullExcel,
  onExportBookingsDbExcel,
  onCommitBookingsImport
}: BookingsViewProps) {
  const checkedTradesTotal = useMemo(() => trades.filter((trade) => !!trade.manualChecked).length, [trades]);
  const [importPreview, setImportPreview] = useState<null | {
    format: "full" | "db";
    rowCount: number;
    draftTrades: Trade[];
    updatedTradeIds: string[];
    baselineTrades: Trade[];
  }>(null);
  const [importNotice, setImportNotice] = useState<null | { kind: "error" | "info"; message: string }>(null);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"Alle" | TradePositionBookingKind>("Alle");
  const [statusFilter, setStatusFilter] = useState<"Alle" | Trade["status"]>("Alle");
  const [checkedFilter, setCheckedFilter] = useState<"Alle" | "Gecheckt" | "Offen">("Alle");
  const [typFilter, setTypFilter] = useState<string[]>([]);
  const [basiswertFilter, setBasiswertFilter] = useState<string[]>([]);
  const [rangeFilter, setRangeFilter] = useState<"Alle" | "heute" | "7" | "30" | "monat" | "jahr" | "365">("Alle");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarRangeStart, setCalendarRangeStart] = useState<string | null>(null);
  const [calendarRangeEnd, setCalendarRangeEnd] = useState<string | null>(null);
  const [calendarIsDragging, setCalendarIsDragging] = useState(false);
  const [calendarDragMoved, setCalendarDragMoved] = useState(false);
  const [sortField, setSortField] = useState<BookingsSortField>("when");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const tradeById = useMemo(() => new Map(trades.map((x) => [x.id, x])), [trades]);
  const availableTypes = useMemo(() => [...new Set(trades.map((x) => x.typ).filter(Boolean))], [trades]);
  const availableBasiswerte = useMemo(() => [...new Set(trades.map((x) => x.basiswert).filter(Boolean))], [trades]);

  const statusOptions: Array<{ value: "Alle" | Trade["status"]; label: string }> = [
    { value: "Alle", label: t(language, "all") },
    { value: "Offen", label: t(language, "open") },
    { value: "Geschlossen", label: t(language, "closed") }
  ];

  const baseFilteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== "Alle" && row.booking.kind !== kindFilter) return false;
      if (statusFilter !== "Alle" && row.tradeStatus !== statusFilter) return false;
      if (checkedFilter === "Gecheckt" && !row.tradeManualChecked) return false;
      if (checkedFilter === "Offen" && row.tradeManualChecked) return false;
      if (typFilter.length > 0 && !typFilter.includes(row.tradeTyp)) return false;
      if (basiswertFilter.length > 0 && !basiswertFilter.includes(row.basiswert)) return false;
      if (!q) return true;
      const hay = [
        row.tradeName,
        row.basiswert,
        row.tradeTyp,
        row.tradeId,
        kindLabel(language, row.booking.kind),
        row.booking.legacyLeg ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, kindFilter, statusFilter, checkedFilter, typFilter, basiswertFilter, language]);

  const bookingsCalendarMap = useMemo(() => {
    const map = new Map<string, number>();
    baseFilteredRows.forEach((row) => {
      const key = bookingYmdKey(row);
      if (!key) return;
      const [yRaw, mRaw] = key.split("-");
      const y = Number(yRaw);
      const m0 = Number(mRaw) - 1;
      if (y !== calendarMonth.getFullYear() || m0 !== calendarMonth.getMonth()) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [baseFilteredRows, calendarMonth]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dateRangeStart =
      calendarRangeStart && calendarRangeEnd
        ? calendarRangeStart < calendarRangeEnd
          ? calendarRangeStart
          : calendarRangeEnd
        : calendarRangeStart;
    const dateRangeEnd =
      calendarRangeStart && calendarRangeEnd
        ? calendarRangeStart > calendarRangeEnd
          ? calendarRangeStart
          : calendarRangeEnd
        : calendarRangeEnd;

    return baseFilteredRows.filter((row) => {
      const d = bookingInstant(row);
      const dates = d ? [d] : [];
      const key = bookingYmdKey(row);
      const keys = key ? [key] : [];

      const matchesRange =
        rangeFilter === "Alle" ||
        (rangeFilter === "heute" && dates.some((x) => x >= startOfToday)) ||
        (rangeFilter === "monat" && dates.some((x) => x >= startOfMonth)) ||
        (rangeFilter === "jahr" && dates.some((x) => x >= startOfYear)) ||
        (rangeFilter === "7" && dates.some((x) => now.getTime() - x.getTime() <= 7 * 24 * 60 * 60 * 1000)) ||
        (rangeFilter === "30" && dates.some((x) => now.getTime() - x.getTime() <= 30 * 24 * 60 * 60 * 1000)) ||
        (rangeFilter === "365" && dates.some((x) => now.getTime() - x.getTime() <= 365 * 24 * 60 * 60 * 1000));
      if (!matchesRange) return false;
      if (!dateRangeStart || !dateRangeEnd) return true;
      if (keys.length === 0) return false;
      return keys.some((k) => k >= dateRangeStart && k <= dateRangeEnd);
    });
  }, [baseFilteredRows, rangeFilter, calendarRangeStart, calendarRangeEnd]);

  const sortedFiltered = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    const numOrNull = (n: number | undefined): number | null =>
      n !== undefined && Number.isFinite(n) ? n : null;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "when": {
          const ta = bookingInstant(a)?.getTime() ?? 0;
          const tb = bookingInstant(b)?.getTime() ?? 0;
          cmp = ta < tb ? -1 : ta > tb ? 1 : 0;
          break;
        }
        case "kind": {
          const ka = KIND_SORT_ORDER[a.booking.kind];
          const kb = KIND_SORT_ORDER[b.booking.kind];
          cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
          break;
        }
        case "name": {
          const na = a.tradeName.toLowerCase();
          const nb = b.tradeName.toLowerCase();
          cmp = na < nb ? -1 : na > nb ? 1 : 0;
          break;
        }
        case "typ": {
          const na = a.tradeTyp.toLowerCase();
          const nb = b.tradeTyp.toLowerCase();
          cmp = na < nb ? -1 : na > nb ? 1 : 0;
          break;
        }
        case "basiswert": {
          const na = a.basiswert.toLowerCase();
          const nb = b.basiswert.toLowerCase();
          cmp = na < nb ? -1 : na > nb ? 1 : 0;
          break;
        }
        case "status": {
          const na = a.tradeStatus;
          const nb = b.tradeStatus;
          cmp = na < nb ? -1 : na > nb ? 1 : 0;
          break;
        }
        case "qty": {
          const qa = numOrNull(a.booking.qty);
          const qb = numOrNull(b.booking.qty);
          if (qa === null && qb === null) cmp = 0;
          else if (qa === null) cmp = sortDirection === "asc" ? 1 : -1;
          else if (qb === null) cmp = sortDirection === "asc" ? -1 : 1;
          else cmp = qa < qb ? -1 : qa > qb ? 1 : 0;
          break;
        }
        case "unit": {
          const qa = numOrNull(a.booking.unitPrice);
          const qb = numOrNull(b.booking.unitPrice);
          if (qa === null && qb === null) cmp = 0;
          else if (qa === null) cmp = sortDirection === "asc" ? 1 : -1;
          else if (qb === null) cmp = sortDirection === "asc" ? -1 : 1;
          else cmp = qa < qb ? -1 : qa > qb ? 1 : 0;
          break;
        }
        case "gross": {
          const ga = a.booking.grossAmount;
          const gb = b.booking.grossAmount;
          cmp = ga < gb ? -1 : ga > gb ? 1 : 0;
          break;
        }
        case "fees": {
          const fa = a.booking.feesAmount;
          const fb = b.booking.feesAmount;
          cmp = fa < fb ? -1 : fa > fb ? 1 : 0;
          break;
        }
        case "tax": {
          const ta = a.booking.taxAmount;
          const tb = b.booking.taxAmount;
          cmp = ta < tb ? -1 : ta > tb ? 1 : 0;
          break;
        }
        case "leg": {
          const la = (a.booking.legacyLeg ?? "").toLowerCase();
          const lb = (b.booking.legacyLeg ?? "").toLowerCase();
          cmp = la < lb ? -1 : la > lb ? 1 : 0;
          break;
        }
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp * dir;
      return a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0;
    });
  }, [filtered, sortField, sortDirection]);

  const stats = useMemo(() => {
    let buyN = 0;
    let sellN = 0;
    let incomeN = 0;
    let taxN = 0;
    let grossBuy = 0;
    let grossSell = 0;
    let grossIncome = 0;
    let fees = 0;
    let taxAmt = 0;
    const tradeIds = new Set<string>();
    for (const row of filtered) {
      tradeIds.add(row.tradeId);
      const k = row.booking.kind;
      const g = row.booking.grossAmount;
      const f = row.booking.feesAmount;
      const tx = row.booking.taxAmount;
      if (k === "BUY") {
        buyN += 1;
        grossBuy += g;
      } else if (k === "SELL") {
        sellN += 1;
        grossSell += g;
      } else if (k === "INCOME") {
        incomeN += 1;
        grossIncome += g;
      } else {
        taxN += 1;
      }
      fees += f;
      taxAmt += tx;
    }
    return {
      rows: filtered.length,
      tradesDistinct: tradeIds.size,
      buyN,
      sellN,
      incomeN,
      taxN,
      grossBuy,
      grossSell,
      grossIncome,
      fees,
      taxAmt
    };
  }, [filtered]);

  const resetFilters = () => {
    setSearch("");
    setKindFilter("Alle");
    setStatusFilter("Alle");
    setCheckedFilter("Alle");
    setTypFilter([]);
    setBasiswertFilter([]);
    setRangeFilter("Alle");
    setCalendarRangeStart(null);
    setCalendarRangeEnd(null);
  };

  const toggleSort = (field: BookingsSortField) => {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDirection(
        field === "name" || field === "typ" || field === "basiswert" || field === "status" || field === "kind" || field === "leg" ? "asc" : "desc"
      );
    }
  };

  const sortMarker = (field: BookingsSortField) => (sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕");

  const currentCalendarYear = calendarMonth.getFullYear();
  const currentCalendarMonth = calendarMonth.getMonth();
  const firstDayOfCalendarMonth = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const daysInCalendarMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const weekStartsOnMonday = weekStartsOn === "monday";
  const calendarStartOffset = weekStartsOnMonday ? (firstDayOfCalendarMonth.getDay() + 6) % 7 : firstDayOfCalendarMonth.getDay();
  const calendarCells = Array.from({ length: calendarStartOffset + daysInCalendarMonth }, (_, idx) => idx - calendarStartOffset + 1);
  const calendarRangeMin =
    calendarRangeStart && calendarRangeEnd
      ? calendarRangeStart < calendarRangeEnd
        ? calendarRangeStart
        : calendarRangeEnd
      : calendarRangeStart;
  const calendarRangeMax =
    calendarRangeStart && calendarRangeEnd
      ? calendarRangeStart > calendarRangeEnd
        ? calendarRangeStart
        : calendarRangeEnd
      : calendarRangeEnd;
  const calendarMonthLabel = getCalendarMonthLabel(calendarMonth);
  const calendarWeekdayNames = getWeekdayNames(weekStartsOn, language);

  const toDateKey = (date: Date) => toLocalYmdKey(date);

  const setSingleDayFilter = (dateKey: string) => {
    setRangeFilter("Alle");
    setCalendarRangeStart(dateKey);
    setCalendarRangeEnd(dateKey);
  };

  const handleCalendarDayMouseDown = (dateKey: string) => {
    setRangeFilter("Alle");
    setCalendarIsDragging(true);
    setCalendarDragMoved(false);
    setCalendarRangeStart(dateKey);
    setCalendarRangeEnd(dateKey);
  };

  const handleCalendarDayMouseEnter = (dateKey: string) => {
    if (!calendarIsDragging) return;
    if (calendarRangeStart && dateKey !== calendarRangeStart) setCalendarDragMoved(true);
    setCalendarRangeEnd(dateKey);
  };

  const handleCalendarMouseUp = () => setCalendarIsDragging(false);

  const clearCalendarFilter = () => {
    setCalendarRangeStart(null);
    setCalendarRangeEnd(null);
  };

  const handleBookingsImportFile = async (file: File, mode: "full" | "db") => {
    setImportNotice({ kind: "info", message: t(language, "bookingsImportChecking") });
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setImportNotice({ kind: "error", message: t(language, "bookingsImportExcelOnly") });
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      let result = runBookingsExcelImport(trades, workbook, mode);
      if (
        !result.ok &&
        ((mode === "full" && result.errorKey === "bookingsImportBadHeader") ||
          (mode === "db" && result.errorKey === "bookingsImportBadHeaderDb"))
      ) {
        // Nutzer hat ggf. das andere Importformat gewählt: automatisch einmal mit dem Gegenformat versuchen.
        const fallbackMode = mode === "full" ? "db" : "full";
        const fallback = runBookingsExcelImport(trades, workbook, fallbackMode);
        if (fallback.ok) {
          result = fallback;
          setImportNotice({
            kind: "info",
            message: t(language, "bookingsImportAutoDetected", {
              format: fallbackMode === "full" ? t(language, "bookingsImportPreviewFormatFull") : t(language, "bookingsImportPreviewFormatDb")
            })
          });
        }
      }
      if (!result.ok) {
        setImportNotice({ kind: "error", message: t(language, result.errorKey as I18nKey, result.vars) });
        return;
      }
      setImportPreview({
        format: result.format,
        rowCount: result.rowCount,
        updatedTradeIds: result.updatedTradeIds,
        draftTrades: structuredClone(result.trades),
        baselineTrades: structuredClone(trades)
      });
      if (result.updatedTradeIds.length === 0) {
        setImportNotice({ kind: "info", message: t(language, "bookingsImportNothingToUpdate") });
      } else if (!importNotice || importNotice.kind !== "info") {
        setImportNotice(null);
      }
    } catch (error) {
      setImportNotice({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <section className="section trades-page">
      <PageHeader
        title={
          <>
            <ClipboardList size={18} />
            {t(language, "bookingsPageTitle")}
          </>
        }
        subtitle={t(language, "bookingsPageSubtitle", { n: filtered.length, total: rows.length, trades: trades.length })}
        actions={
          <>
            <input
              id="bookings-full-import-input"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleBookingsImportFile(file, "full");
                event.target.value = "";
              }}
            />
            <input
              id="bookings-db-import-input"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleBookingsImportFile(file, "db");
                event.target.value = "";
              }}
            />
            <details className="actions-dropdown">
              <summary className="secondary">
                <Upload size={14} />
                {t(language, "import")}
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <label htmlFor="bookings-full-import-input" className="actions-dropdown-item file-pick-btn">
                  <span className="actions-dropdown-item-content">
                    <Upload size={14} />
                    {t(language, "bookingsImportExcel")}
                  </span>
                  <small>{t(language, "bookingsImportExcelHint")}</small>
                </label>
                <label htmlFor="bookings-db-import-input" className="actions-dropdown-item file-pick-btn">
                  <span className="actions-dropdown-item-content">
                    <Upload size={14} />
                    {t(language, "bookingsImportDbExcel")}
                  </span>
                  <small>{t(language, "bookingsImportDbExcelHint")}</small>
                </label>
              </div>
            </details>
            <details className="actions-dropdown">
              <summary className="secondary">
                <FileDown size={14} />
                {t(language, "export")}
                <ChevronDown size={14} />
              </summary>
              <div className="actions-dropdown-menu">
                <button className="actions-dropdown-item" onClick={onExportBookingsFullExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(language, "bookingsFullExportExcel")}
                  </span>
                  <small>{t(language, "bookingsFullExportExcelHint")}</small>
                </button>
                <button className="actions-dropdown-item" onClick={onExportBookingsDbExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(language, "bookingsDbExportExcel")}
                  </span>
                  <small>{t(language, "bookingsDbExportExcelHint")}</small>
                </button>
              </div>
            </details>
          </>
        }
      />

      <section className="kpis trades-kpis">
        {importNotice ? (
          <div
            className="card"
            style={{
              borderColor: importNotice.kind === "error" ? "var(--negative, #c93a3a)" : "var(--border)",
              gridColumn: "1 / -1"
            }}
          >
            <p style={{ margin: 0 }}>{importNotice.message}</p>
          </div>
        ) : null}
        <div className="card">
          <h3>
            <Layers size={14} />
            {t(language, "bookingsStatVisibleRows")}
          </h3>
          <div className="value">{stats.rows}</div>
        </div>
        <div className="card">
          <h3>
            <Briefcase size={14} />
            {t(language, "bookingsStatDistinctTrades")}
          </h3>
          <div className="value">{stats.tradesDistinct}</div>
        </div>
        <div className="card">
          <h3>
            <TrendingUp size={14} />
            {t(language, "bookingsStatLegBuy")}
          </h3>
          <div className="value positive">{stats.buyN}</div>
        </div>
        <div className="card">
          <h3>
            <TrendingDown size={14} />
            {t(language, "bookingsStatLegSell")}
          </h3>
          <div className="value">{stats.sellN}</div>
        </div>
        <div className="card">
          <h3>
            <Layers size={14} />
            {t(language, "manualCheckedProgress")}
          </h3>
          <div className="value">
            {checkedTradesTotal} / {trades.length}
          </div>
        </div>
      </section>

      <div className="trades-summary-grid trades-summary-grid-spaced">
        <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(language, "bookingsSigmaGrossBuy")}
          </h3>
          <div className="value">{money(stats.grossBuy)}</div>
        </div>
        <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(language, "bookingsSigmaGrossSell")}
          </h3>
          <div className="value">{money(stats.grossSell)}</div>
        </div>
        <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(language, "bookingsSigmaGrossIncome")}
          </h3>
          <div className="value">{money(stats.grossIncome)}</div>
        </div>
        <div className="card">
          <h3>
            <HandCoins size={14} />
            {t(language, "bookingsSigmaFees")}
          </h3>
          <div className="value">{money(stats.fees)}</div>
        </div>
        <div className="card">
          <h3>
            <HandCoins size={14} />
            {t(language, "bookingsSigmaTax")}
          </h3>
          <div className={`value ${stats.taxAmt >= 0 ? "" : "negative"}`}>{money(stats.taxAmt)}</div>
        </div>
        <div className="card">
          <h3>
            <Layers size={14} />
            {t(language, "bookingsStatIncomeLegs")}
          </h3>
          <div className="value">{stats.incomeN}</div>
        </div>
        <div className="card">
          <h3>
            <Layers size={14} />
            {t(language, "bookingsStatTaxLegs")}
          </h3>
          <div className="value">{stats.taxN}</div>
        </div>
      </div>

      <div className="trades-controls-layout">
        <div className="trades-controls-main">
          {trades.length === 0 ? (
            <div className="card">
              <h3>{t(language, "importGuideTitle")}</h3>
              <p>{t(language, "importGuideP1")}</p>
              <p>{t(language, "importGuideP2")}</p>
              <p>{t(language, "importGuideP3")}</p>
            </div>
          ) : null}
          <div className="card trades-filters-card trades-filters-search-card">
            <label className="trades-single-search">
              <span className="label-with-icon">
                <Search size={13} />
                {t(language, "search")}
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(language, "bookingsSearchPlaceholder")}
                autoComplete="off"
              />
            </label>
          </div>
          <div className="card trades-filters-card trades-filters-card-main">
            <div className="trades-filters-top-actions">
              <button type="button" className="secondary slim" onClick={resetFilters}>
                {t(language, "reset")}
              </button>
            </div>
            <div className="trades-filters-grid">
              <label>
                {t(language, "status")}
                <div className="trades-status-switcher" role="tablist" aria-label={t(language, "status")}>
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`trades-status-switch ${statusFilter === option.value ? "is-active" : ""}`}
                      onClick={() => setStatusFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                {t(language, "bookingsFilterKind")}
                <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "Alle" | TradePositionBookingKind)}>
                  <option value="Alle">{t(language, "bookingsKindAll")}</option>
                  <option value="BUY">{t(language, "buy")}</option>
                  <option value="SELL">{t(language, "sell")}</option>
                  <option value="INCOME">{t(language, "incomeBooking")}</option>
                  <option value="TAX_CORRECTION">{t(language, "cloudBookingKindTaxCorr")}</option>
                </select>
              </label>
              <label>
                {t(language, "manualChecked")}
                <select value={checkedFilter} onChange={(e) => setCheckedFilter(e.target.value as "Alle" | "Gecheckt" | "Offen")}>
                  <option value="Alle">{t(language, "all")}</option>
                  <option value="Gecheckt">{t(language, "manualCheckedDone")}</option>
                  <option value="Offen">{t(language, "manualCheckedTodo")}</option>
                </select>
              </label>
              <label>
                {t(language, "type")}
                <select
                  multiple
                  size={6}
                  value={typFilter}
                  onChange={(e) => setTypFilter(Array.from(e.target.selectedOptions, (o) => o.value))}
                >
                  {availableTypes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(language, "basiswert")}
                <select
                  multiple
                  size={6}
                  value={basiswertFilter}
                  onChange={(e) => setBasiswertFilter(Array.from(e.target.selectedOptions, (o) => o.value))}
                >
                  {availableBasiswerte.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(language, "range")}
                <select
                  value={rangeFilter}
                  onChange={(e) => {
                    setRangeFilter(e.target.value as typeof rangeFilter);
                    setCalendarRangeStart(null);
                    setCalendarRangeEnd(null);
                  }}
                >
                  <option value="Alle">{t(language, "all")}</option>
                  <option value="heute">{t(language, "bookingsRangeToday")}</option>
                  <option value="7">{t(language, "days7")}</option>
                  <option value="30">{t(language, "days30")}</option>
                  <option value="monat">{t(language, "bookingsRangeMonth")}</option>
                  <option value="jahr">{t(language, "bookingsRangeYear")}</option>
                  <option value="365">{t(language, "days365")}</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="card trades-inline-calendar-card" onMouseUp={handleCalendarMouseUp} onMouseLeave={handleCalendarMouseUp}>
          <div className="trades-inline-calendar-head">
            <button type="button" className="secondary slim" onClick={() => setCalendarMonth(new Date(currentCalendarYear, currentCalendarMonth - 1, 1))}>
              ◀
            </button>
            <strong>{calendarMonthLabel}</strong>
            <button type="button" className="secondary slim" onClick={() => setCalendarMonth(new Date(currentCalendarYear, currentCalendarMonth + 1, 1))}>
              ▶
            </button>
            <button type="button" className="secondary slim" onClick={clearCalendarFilter}>
              {t(language, "reset")}
            </button>
          </div>
          <div className="month-weekdays inline">
            {calendarWeekdayNames.map((weekday) => (
              <span key={`bk-cal-${weekday}`}>{weekday}</span>
            ))}
          </div>
          <div className="month-days inline">
            {calendarCells.map((day, idx) => {
              if (day < 1) {
                return <div key={`bk-empty-${idx}`} className="day-cell empty" />;
              }
              const key = toDateKey(new Date(currentCalendarYear, currentCalendarMonth, day));
              const count = bookingsCalendarMap.get(key) ?? 0;
              const inRange = !!(calendarRangeMin && calendarRangeMax && key >= calendarRangeMin && key <= calendarRangeMax);
              const isBoundary = key === calendarRangeStart || key === calendarRangeEnd;
              return (
                <button
                  key={`bk-${key}`}
                  type="button"
                  className={`day-cell inline ${inRange ? "in-range" : ""} ${isBoundary ? "range-boundary" : ""}`}
                  title={t(language, "bookingsCalendarDayTitle", { date: key, n: count })}
                  onMouseDown={() => handleCalendarDayMouseDown(key)}
                  onMouseEnter={() => handleCalendarDayMouseEnter(key)}
                  onMouseUp={handleCalendarMouseUp}
                  onClick={() => {
                    if (calendarDragMoved) {
                      setCalendarDragMoved(false);
                      return;
                    }
                    setSingleDayFilter(key);
                  }}
                >
                  <span className="day-number">{day}</span>
                  <div className="day-icons">
                    {count > 0 ? <span className="day-more">{count}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="journal-week-table-wrap">
          <table className="journal-week-table bookings-all-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("when")}>
                  {t(language, "bookingsColWhen")}
                  {sortMarker("when")}
                </th>
                <th className="sortable" onClick={() => toggleSort("kind")}>
                  {t(language, "booking")}
                  {sortMarker("kind")}
                </th>
                <th className="sortable" onClick={() => toggleSort("name")}>
                  {t(language, "name")}
                  {sortMarker("name")}
                </th>
                <th className="sortable" onClick={() => toggleSort("typ")}>
                  {t(language, "type")}
                  {sortMarker("typ")}
                </th>
                <th className="sortable" onClick={() => toggleSort("basiswert")}>
                  {t(language, "basiswert")}
                  {sortMarker("basiswert")}
                </th>
                <th className="sortable" onClick={() => toggleSort("status")}>
                  {t(language, "status")}
                  {sortMarker("status")}
                </th>
                <th>{t(language, "manualCheckedShort")}</th>
                <th className={`bookings-num-col sortable`} onClick={() => toggleSort("qty")}>
                  {t(language, "shares")}
                  {sortMarker("qty")}
                </th>
                <th className={`bookings-num-col sortable`} onClick={() => toggleSort("unit")}>
                  {t(language, "cloudBookingsColUnit")}
                  {sortMarker("unit")}
                </th>
                <th className={`bookings-num-col sortable`} onClick={() => toggleSort("gross")}>
                  {t(language, "cloudBookingsColGross")}
                  {sortMarker("gross")}
                </th>
                <th className={`bookings-num-col sortable`} onClick={() => toggleSort("fees")}>
                  {t(language, "cloudBookingsColFees")}
                  {sortMarker("fees")}
                </th>
                <th className={`bookings-num-col sortable`} onClick={() => toggleSort("tax")}>
                  {t(language, "tradeTaxes")}
                  {sortMarker("tax")}
                </th>
                <th className="sortable" onClick={() => toggleSort("leg")}>
                  {t(language, "bookingsColLeg")}
                  {sortMarker("leg")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((row) => {
                const b = row.booking;
                const trade = tradeById.get(row.tradeId);
                return (
                  <tr
                    key={row.rowKey}
                    className={trade ? "bookings-row-open" : undefined}
                    title={trade ? t(language, "bookingsOpenTradeRowTitle") : undefined}
                    onClick={() => {
                      if (trade) onEditTrade(trade);
                    }}
                  >
                    <td>{b.bookedAtDisplay || "—"}</td>
                    <td>{kindLabel(language, b.kind)}</td>
                    <td>{row.tradeName}</td>
                    <td>{row.tradeTyp}</td>
                    <td>{row.basiswert || "—"}</td>
                    <td>{row.tradeStatus}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={row.tradeManualChecked}
                        title={t(language, "manualChecked")}
                        onChange={(e) => onToggleTradeManualChecked(row.tradeId, e.target.checked)}
                      />
                    </td>
                    <td className="bookings-num-col">{b.qty !== undefined && Number.isFinite(b.qty) ? String(b.qty) : "—"}</td>
                    <td className="bookings-num-col">{b.unitPrice !== undefined && Number.isFinite(b.unitPrice) ? money(b.unitPrice) : "—"}</td>
                    <td className="bookings-num-col">{money(b.grossAmount)}</td>
                    <td className="bookings-num-col">{money(b.feesAmount)}</td>
                    <td className="bookings-num-col">{money(b.taxAmount)}</td>
                    <td>
                      <code className="booking-leg-code">{b.legacyLeg ?? "—"}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sortedFiltered.length === 0 ? (
          <p className="muted" style={{ padding: "0.75rem 1rem" }}>
            {t(language, "bookingsEmpty")}
          </p>
        ) : null}
      </div>

      {importPreview ? (
        <BookingsImportPreviewModal
          language={language}
          format={importPreview.format}
          rowCount={importPreview.rowCount}
          updatedTradeIds={importPreview.updatedTradeIds}
          draftTrades={importPreview.draftTrades}
          baselineTrades={importPreview.baselineTrades}
          onClose={() => setImportPreview(null)}
          onConfirm={() => {
            if (!importPreview) return;
            onCommitBookingsImport(importPreview.draftTrades, {
              updatedTradeCount: importPreview.updatedTradeIds.length,
              rowCount: importPreview.rowCount
            });
            setImportPreview(null);
          }}
        />
      ) : null}
    </section>
  );
}
