import { CheckCircle2, ChevronDown, Circle, CircleDollarSign, Copy, ExternalLink, FileDown, FileSpreadsheet, Filter, HandCoins, Layers, Plus, Search, TrendingDown, TrendingUp, Upload, Briefcase } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../app/i18n";
import { formatDateTimeAT } from "../../app/date";
import type { SortDirection, TradesSortField } from "../../app/types";
import type { AppSettings } from "../../app/settings";
import { getTradeBoughtQty, getTradeRealizedPL, getTradeSoldQty, isTradeClosed, money } from "../../lib/analytics";
import type { Trade } from "../../types/trade";
import { TRADES_COLUMN_PREFS_STORAGE_KEY } from "../../lib/backup";
import { buildTraderSearchUrl, getTraderProviderDisplayNameForLanguage, getTraderSearchQueryForTrade, traderProviderShortLabel } from "../../lib/traderLinks";
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
  checkedFilter: "Alle" | "Gecheckt" | "Offen";
  onCheckedFilterChange: (value: "Alle" | "Gecheckt" | "Offen") => void;
  sourceFilter: "Alle" | Trade["sourceBroker"];
  onSourceFilterChange: (value: "Alle" | Trade["sourceBroker"]) => void;
  typFilter: string[];
  onTypFilterChange: (value: string[]) => void;
  basiswertFilter: string[];
  onBasiswertFilterChange: (value: string[]) => void;
  rangeFilter: "Alle" | "heute" | "7" | "30" | "monat" | "jahr" | "365";
  onRangeFilterChange: (value: "Alle" | "heute" | "7" | "30" | "monat" | "jahr" | "365") => void;
  onResetFilters: () => void;
  availableTypes: string[];
  availableBasiswerte: string[];
  availableSources: Trade["sourceBroker"][];
  sortMarker: (field: TradesSortField) => string;
  onToggleSort: (field: TradesSortField) => void;
  onImportTradesFile: (file: File) => Promise<void>;
  onDownloadImportTemplateCsv: () => void;
  onDownloadImportTemplateExcel: () => void;
  onExportTradesCsvForExcel: () => void;
  onExportTradesFullExcel: () => void;
  onExportTradesDbExcel: () => void;
  onGoToNewTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onToggleTradeManualChecked: (tradeId: string, checked: boolean) => void;
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
  traderProviders: AppSettings["traderProviders"];
}

export function TradesView(props: TradesViewProps) {
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "ok" | "error">("idle");
  const [isMobile, setIsMobile] = useState<boolean>(() => (typeof window !== "undefined" ? window.innerWidth <= 760 : false));
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileShowAllKpis, setMobileShowAllKpis] = useState(false);
  const [draftSearch, setDraftSearch] = useState(props.search);
  const [draftStatusFilter, setDraftStatusFilter] = useState(props.statusFilter);
  const [draftSourceFilter, setDraftSourceFilter] = useState(props.sourceFilter);
  const [draftTypFilter, setDraftTypFilter] = useState<string[]>(props.typFilter);
  const [draftBasiswertFilter, setDraftBasiswertFilter] = useState<string[]>(props.basiswertFilter);
  const [draftRangeFilter, setDraftRangeFilter] = useState(props.rangeFilter);
  const checkedCount = useMemo(() => props.trades.filter((trade) => !!trade.manualChecked).length, [props.trades]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (props.search.trim()) count += 1;
    if (props.statusFilter !== "Alle") count += 1;
    if (props.sourceFilter !== "Alle") count += 1;
    if (props.typFilter.length > 0) count += 1;
    if (props.basiswertFilter.length > 0) count += 1;
    if (props.rangeFilter !== "Alle") count += 1;
    return count;
  }, [
    props.search,
    props.statusFilter,
    props.sourceFilter,
    props.typFilter.length,
    props.basiswertFilter.length,
    props.rangeFilter
  ]);
  const visibleKpiIds = useMemo(
    () => (isMobile && !mobileShowAllKpis ? ["total", "open", "realized", "checked"] : ["total", "open", "winners", "losers", "checked", "buy", "sell", "capital", "realized"]),
    [isMobile, mobileShowAllKpis]
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!mobileFilterOpen) return;
    setDraftSearch(props.search);
    setDraftStatusFilter(props.statusFilter);
    setDraftSourceFilter(props.sourceFilter);
    setDraftTypFilter(props.typFilter);
    setDraftBasiswertFilter(props.basiswertFilter);
    setDraftRangeFilter(props.rangeFilter);
  }, [mobileFilterOpen, props.search, props.statusFilter, props.sourceFilter, props.typFilter, props.basiswertFilter, props.rangeFilter]);

  useEffect(() => {
    if (props.checkedFilter !== "Alle") props.onCheckedFilterChange("Alle");
  }, [props.checkedFilter, props.onCheckedFilterChange]);

  const columnPrefsKey = TRADES_COLUMN_PREFS_STORAGE_KEY;
  const statusBaseOptions: Array<{ value: "Alle" | Trade["status"]; label: string }> = [
    { value: "Alle", label: t(props.language, "all") },
    { value: "Offen", label: t(props.language, "open") },
    { value: "Geschlossen", label: t(props.language, "closed") }
  ];
  const statusOptions: Array<{ value: "Alle" | Trade["status"]; label: string; icon: JSX.Element }> = statusBaseOptions.map((option) => ({
    ...option,
    icon:
      option.value === "Offen" ? (
        <Circle size={13} />
      ) : option.value === "Geschlossen" ? (
        <CheckCircle2 size={13} />
      ) : (
        <Layers size={13} />
      )
  }));

  const singleSelectToArray = (value: string): string[] => {
    if (value === "Alle") return [];
    return [value];
  };

  const arrayToSingleSelect = (values: string[]): string => {
    if (!values.length) return "Alle";
    return values[0];
  };
  type ColumnId =
    | "status"
    | "manualChecked"
    | "source"
    | "kaufzeitpunkt"
    | "verkaufszeitpunkt"
    | "name"
    | "typ"
    | "basiswert"
    | "kaufStueck"
    | "verkaufStueck"
    | "extern"
    | "isin"
    | "wkn"
    | "kaufPreis"
    | "verkaufPreis"
    | "tradeTaxes"
    | "gewinn"
    | "rendite";

  const defaultVisible: Record<ColumnId, boolean> = {
    status: true,
    manualChecked: true,
    source: true,
    kaufzeitpunkt: true,
    verkaufszeitpunkt: true,
    name: true,
    typ: true,
    basiswert: true,
    kaufStueck: true,
    verkaufStueck: true,
    extern: true,
    isin: true,
    wkn: true,
    kaufPreis: true,
    verkaufPreis: true,
    tradeTaxes: true,
    gewinn: true,
    rendite: true
  };

  const defaultOrder: ColumnId[] = [
    "status",
    "manualChecked",
    "source",
    "kaufzeitpunkt",
    "verkaufszeitpunkt",
    "name",
    "typ",
    "basiswert",
    "kaufStueck",
    "verkaufStueck",
    "extern",
    "isin",
    "wkn",
    "kaufPreis",
    "verkaufPreis",
    "tradeTaxes",
    "gewinn",
    "rendite"
  ];

  const initialPrefs = useMemo(() => {
    if (typeof window === "undefined") return { order: defaultOrder, visible: defaultVisible };
    try {
      const raw = window.localStorage.getItem(columnPrefsKey);
      if (!raw) return { order: defaultOrder, visible: defaultVisible };
      const parsed = JSON.parse(raw) as { order?: ColumnId[]; visible?: Partial<Record<ColumnId, boolean>> };
      const order = Array.isArray(parsed.order) && parsed.order.length ? parsed.order.filter((id) => id in defaultVisible) : defaultOrder;
      const visible = { ...defaultVisible, ...(parsed.visible ?? {}) };
      // Stelle sicher, dass alle IDs existieren.
      defaultOrder.forEach((id) => {
        if (!(id in visible)) visible[id] = defaultVisible[id];
      });
      // Fehlende IDs ans Ende hängen.
      const missing = defaultOrder.filter((id) => !order.includes(id));
      return { order: [...order, ...missing], visible };
    } catch {
      return { order: defaultOrder, visible: defaultVisible };
    }
  }, [columnPrefsKey]);

  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(initialPrefs.order);
  const [visibleById, setVisibleById] = useState<Record<ColumnId, boolean>>(initialPrefs.visible);
  const dragIdRef = useRef<ColumnId | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(columnPrefsKey, JSON.stringify({ order: columnOrder, visible: visibleById }));
    } catch {
      // Ignoriere Storage-Fehler (z.B. private browsing).
    }
  }, [columnOrder, visibleById]);

  const alwaysVisible = useMemo(() => new Set<ColumnId>(["status"]), []);
  const sourceLabel = (source?: Trade["sourceBroker"]) => {
    if (!source) return "MANUAL";
    if (source === "TRADE_REPUBLIC") return "Trade Republic";
    return source;
  };

  const columnDefs = (() => {
    const defs: Record<ColumnId, any> = {
      status: {
        id: "status" satisfies ColumnId,
        label: "",
        visible: true,
        draggable: true,
        render: (trade: Trade) => (
          <>{isTradeClosed(trade) ? <CheckCircle2 size={16} className="status-icon closed" /> : <Circle size={16} className="status-icon open" />}</>
        )
      },
      manualChecked: {
        id: "manualChecked" satisfies ColumnId,
        label: t(props.language, "manualCheckedShort"),
        visible: true,
        draggable: true,
        render: (trade: Trade) => (
          <input
            type="checkbox"
            checked={!!trade.manualChecked}
            title={t(props.language, "manualChecked")}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => props.onToggleTradeManualChecked(trade.id, e.target.checked)}
          />
        )
      },
      source: {
        id: "source" satisfies ColumnId,
        label: t(props.language, "source"),
        draggable: true,
        render: (trade: Trade) => sourceLabel(trade.sourceBroker)
      },
      kaufzeitpunkt: {
        id: "kaufzeitpunkt" satisfies ColumnId,
        label: t(props.language, "buy"),
        sortable: "kauf" as TradesSortField,
        draggable: true,
        render: (trade: Trade) => formatDateTimeAT(trade.kaufzeitpunkt)
      },
      verkaufszeitpunkt: {
        id: "verkaufszeitpunkt" satisfies ColumnId,
        label: t(props.language, "sell"),
        sortable: "verkauf" as TradesSortField,
        draggable: true,
        render: (trade: Trade) =>
          formatDateTimeAT(["Steuerkorrektur", "Dividende", "Zinszahlung"].includes(trade.typ) ? trade.kaufzeitpunkt : trade.verkaufszeitpunkt)
      },
      name: {
        id: "name" satisfies ColumnId,
        label: t(props.language, "name"),
        sortable: "name" as TradesSortField,
        draggable: true,
        render: (trade: Trade) => trade.name
      },
      typ: {
        id: "typ" satisfies ColumnId,
        label: t(props.language, "type"),
        sortable: "typ" as TradesSortField,
        draggable: true,
        render: (trade: Trade) => trade.typ
      },
      basiswert: {
        id: "basiswert" satisfies ColumnId,
        label: t(props.language, "basiswert"),
        draggable: true,
        render: (trade: Trade) => trade.basiswert?.trim() ? trade.basiswert : "-"
      },
      kaufStueck: {
        id: "kaufStueck" satisfies ColumnId,
        label: "K#",
        draggable: true,
        render: (trade: Trade) => {
          const q = getTradeBoughtQty(trade);
          return q > 0 ? q : trade.stueck !== undefined ? trade.stueck : "-";
        }
      },
      verkaufStueck: {
        id: "verkaufStueck" satisfies ColumnId,
        label: "V#",
        draggable: true,
        render: (trade: Trade) => {
          const sold = getTradeSoldQty(trade);
          return sold > 0 ? sold : "-";
        }
      },
      extern: {
        id: "extern" satisfies ColumnId,
        label: t(props.language, "extern"),
        draggable: true,
        render: (trade: Trade) => <>{renderTraderLinkCell(trade)}</>
      },
      isin: {
        id: "isin" satisfies ColumnId,
        label: "ISIN",
        draggable: true,
        render: (trade: Trade) => trade.isin || "-"
      },
      wkn: {
        id: "wkn" satisfies ColumnId,
        label: "WKN",
        draggable: true,
        render: (trade: Trade) => trade.wkn || "-"
      },
      kaufPreis: {
        id: "kaufPreis" satisfies ColumnId,
        label: t(props.language, "buyEur"),
        sortable: "kaufPreis" as TradesSortField,
        draggable: true,
        render: (trade: Trade) => money(trade.kaufPreis)
      },
      verkaufPreis: {
        id: "verkaufPreis" satisfies ColumnId,
        label: t(props.language, "sellEur"),
        sortable: "verkaufPreis" as TradesSortField,
        draggable: true,
        render: (trade: Trade) => (trade.verkaufPreis ? money(trade.verkaufPreis) : "-")
      },
      tradeTaxes: {
        id: "tradeTaxes" satisfies ColumnId,
        label: t(props.language, "tradeTaxes"),
        draggable: true,
        render: (trade: Trade) => (trade.verkaufSteuern !== undefined ? money(trade.verkaufSteuern) : "-")
      },
      gewinn: {
        id: "gewinn" satisfies ColumnId,
        label: t(props.language, "profit"),
        sortable: "gewinn" as TradesSortField,
        draggable: true,
        render: (trade: Trade) =>
          trade.typ === "Steuerkorrektur" ? "-" : <span className={getTradeRealizedPL(trade) >= 0 ? "positive" : "negative"}>{money(getTradeRealizedPL(trade))}</span>
      },
      rendite: {
        id: "rendite" satisfies ColumnId,
        label: t(props.language, "pct"),
        sortable: "rendite" as TradesSortField,
        draggable: true,
        render: (trade: Trade) => {
          if (trade.typ === "Steuerkorrektur") return "-";
          if (trade.kaufPreis > 0 && isTradeClosed(trade)) {
            const v = (getTradeRealizedPL(trade) / trade.kaufPreis) * 100;
            return (
              <span className={v >= 0 ? "positive" : "negative"}>{`${v.toFixed(1)}%`}</span>
            );
          }
          return "-";
        }
      }
    };
    return defs as Record<ColumnId, { id: ColumnId; label: string; sortable?: TradesSortField; draggable: boolean; render: (trade: Trade) => JSX.Element | string | null }>;
  })();

  const renderedColumns = useMemo(() => columnOrder.filter((id) => visibleById[id]), [columnOrder, visibleById]);

  const getColumnHeader = (id: ColumnId) => {
    if (id === "status") return t(props.language, "status");
    return columnDefs[id].label || id;
  };

  const getCellText = (id: ColumnId, trade: Trade): string => {
    switch (id) {
      case "status":
        return isTradeClosed(trade) ? t(props.language, "closed") : t(props.language, "open");
      case "kaufzeitpunkt":
        return formatDateTimeAT(trade.kaufzeitpunkt);
      case "manualChecked":
        return trade.manualChecked ? "✓" : "—";
      case "source":
        return sourceLabel(trade.sourceBroker);
      case "verkaufszeitpunkt":
        return formatDateTimeAT(["Steuerkorrektur", "Dividende", "Zinszahlung"].includes(trade.typ) ? trade.kaufzeitpunkt : trade.verkaufszeitpunkt);
      case "name":
        return trade.name;
      case "typ":
        return trade.typ;
      case "basiswert":
        return trade.basiswert?.trim() ? trade.basiswert : "-";
      case "kaufStueck": {
        const b = getTradeBoughtQty(trade);
        return b > 0 ? `${b}` : trade.stueck !== undefined ? `${trade.stueck}` : "-";
      }
      case "verkaufStueck": {
        const s = getTradeSoldQty(trade);
        return s > 0 ? `${s}` : "-";
      }
      case "extern":
        return getTraderSearchQueryForTrade(trade) || "-";
      case "isin":
        return trade.isin || "-";
      case "wkn":
        return trade.wkn || "-";
      case "kaufPreis":
        return money(trade.kaufPreis);
      case "verkaufPreis":
        return trade.verkaufPreis ? money(trade.verkaufPreis) : "-";
      case "tradeTaxes":
        return trade.verkaufSteuern !== undefined ? money(trade.verkaufSteuern) : "-";
      case "gewinn":
        return trade.typ === "Steuerkorrektur" ? "-" : money(getTradeRealizedPL(trade));
      case "rendite":
        if (trade.typ === "Steuerkorrektur") return "-";
        if (trade.kaufPreis > 0 && isTradeClosed(trade)) {
          const v = (getTradeRealizedPL(trade) / trade.kaufPreis) * 100;
          return `${v.toFixed(1)}%`;
        }
        return "-";
      default:
        return "";
    }
  };

  const copyVisibleTradesToClipboard = async () => {
    const copyColumns = renderedColumns;
    const rows = props.filteredTrades.slice(0, 500);
    const toMdCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    const headerLine = `| ${copyColumns.map((id) => toMdCell(getColumnHeader(id))).join(" | ")} |`;
    const dividerLine = `| ${copyColumns.map(() => "---").join(" | ")} |`;
    const bodyLines = rows.map((trade) => `| ${copyColumns.map((id) => toMdCell(getCellText(id, trade))).join(" | ")} |`);
    const payload = [headerLine, dividerLine, ...bodyLines].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopyFeedback("ok");
    } catch {
      setCopyFeedback("error");
    }
    window.setTimeout(() => setCopyFeedback("idle"), 1800);
  };

  const applyMobileFilters = () => {
    props.onSearchChange(draftSearch);
    props.onStatusFilterChange(draftStatusFilter);
    props.onCheckedFilterChange("Alle");
    props.onSourceFilterChange(draftSourceFilter);
    props.onTypFilterChange(draftTypFilter);
    props.onBasiswertFilterChange(draftBasiswertFilter);
    props.onRangeFilterChange(draftRangeFilter);
    setMobileFilterOpen(false);
  };

  const resetMobileFilters = () => {
    setDraftSearch("");
    setDraftStatusFilter("Alle");
    setDraftSourceFilter("Alle");
    setDraftTypFilter([]);
    setDraftBasiswertFilter([]);
    setDraftRangeFilter("Alle");
  };

  const reorderVisibleColumns = (from: ColumnId, to: ColumnId) => {
    if (from === to) return;
    setColumnOrder((prev) => {
      const prevVisible = prev.filter((id) => visibleById[id]);
      const fromIdx = prevVisible.indexOf(from);
      const toIdx = prevVisible.indexOf(to);
      if (fromIdx < 0 || toIdx < 0) return prev;

      const nextVisible = [...prevVisible];
      nextVisible.splice(fromIdx, 1);
      const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
      nextVisible.splice(insertAt, 0, from);

      // Ordne nur die sichtbaren Elemente um; versteckte bleiben exakt an ihrer bisherigen Position.
      const nextFull = [...prev];
      let v = 0;
      for (let i = 0; i < nextFull.length; i++) {
        if (visibleById[nextFull[i]]) nextFull[i] = nextVisible[v++];
      }
      return nextFull;
    });
  };

  const renderTraderLinkCell = (trade: Trade) => {
    const providers = props.traderProviders;
    if (!providers.length) return null;

    const query = getTraderSearchQueryForTrade(trade);
    const primary = providers[0];
    const primaryUrl = buildTraderSearchUrl(primary, query);

    const openLabel = t(props.language, "externOpen", { provider: getTraderProviderDisplayNameForLanguage(props.language, primary) });

    if (providers.length === 1) {
      return (
        <a
          className="secondary slim finance-link-btn icon-only"
          href={primaryUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={openLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ fontWeight: 800, fontSize: 12 }}>{traderProviderShortLabel(primary)}</span>
        </a>
      );
    }

    return (
      <div className="table-actions" onClick={(e) => e.stopPropagation()}>
        <a
          className="secondary slim finance-link-btn icon-only"
          href={primaryUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={openLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ fontWeight: 800, fontSize: 12 }}>{traderProviderShortLabel(primary)}</span>
        </a>

        <details className="actions-dropdown">
          <summary
            className="secondary finance-link-btn icon-only"
            style={{ padding: 0, cursor: "pointer" }}
            title={t(props.language, "extern")}
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronDown size={14} />
          </summary>
          <div className="actions-dropdown-menu">
            {providers.map((providerId) => {
              const url = buildTraderSearchUrl(providerId, query);
              const label = getTraderProviderDisplayNameForLanguage(props.language, providerId);
              return (
                <a
                  key={providerId}
                  className="actions-dropdown-item"
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="actions-dropdown-item-content">
                    <ExternalLink size={14} />
                    {label}
                    <span style={{ marginLeft: 6, color: "var(--muted)", fontWeight: 700 }}>{traderProviderShortLabel(providerId)}</span>
                  </span>
                  <small style={{ wordBreak: "break-word" }}>{query || "—"}</small>
                </a>
              );
            })}
          </div>
        </details>
      </div>
    );
  };

  return (
    <section className={`section trades-page overview-page${isMobile ? " trades-page--mobile-sticky-bar" : ""}`}>
      <PageHeader
        className={isMobile ? "page-header--mobile-one-hand" : undefined}
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
                <button className="actions-dropdown-item" onClick={props.onExportTradesFullExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(props.language, "tradesFullExportExcel")}
                  </span>
                  <small>{t(props.language, "tradesFullExportExcelHint")}</small>
                </button>
                <button className="actions-dropdown-item" onClick={props.onExportTradesDbExcel}>
                  <span className="actions-dropdown-item-content">
                    <FileSpreadsheet size={14} />
                    {t(props.language, "tradesDbExportExcel")}
                  </span>
                  <small>{t(props.language, "tradesDbExportExcelHint")}</small>
                </button>
              </div>
            </details>
            {!isMobile ? (
              <button className="primary new-trade-cta" onClick={props.onGoToNewTrade}>
                <Plus size={14} />
                {t(props.language, "newTrade")}
              </button>
            ) : null}
          </>
        }
      />

      <section className="kpis trades-kpis overview-kpis">
        {visibleKpiIds.includes("total") ? <div className="card">
          <h3>
            <Briefcase size={14} />
            {t(props.language, "tradesTotal")}
          </h3>
          <div className="value">{props.kpis.totalTrades}</div>
        </div> : null}
        {visibleKpiIds.includes("open") ? <div className="card">
          <h3>
            <Layers size={14} />
            {t(props.language, "openPositions")}
          </h3>
          <div className="value">{props.kpis.openTrades}</div>
        </div> : null}
        {visibleKpiIds.includes("winners") ? <div className="card">
          <h3>
            <TrendingUp size={14} />
            {t(props.language, "winners")}
          </h3>
          <div className="value positive">{props.tradesSummary.winners}</div>
        </div> : null}
        {visibleKpiIds.includes("losers") ? <div className="card">
          <h3>
            <TrendingDown size={14} />
            {t(props.language, "losers")}
          </h3>
          <div className="value negative">{props.tradesSummary.losers}</div>
        </div> : null}
        {visibleKpiIds.includes("checked") ? <div className="card">
          <h3>
            <CheckCircle2 size={14} />
            {t(props.language, "manualCheckedProgress")}
          </h3>
          <div className="value">
            {checkedCount} / {props.trades.length}
          </div>
        </div> : null}
        {visibleKpiIds.includes("buy") ? <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(props.language, "sigmaBuy")}
          </h3>
          <div className="value">{money(props.tradesSummary.totalKauf)}</div>
        </div> : null}
        {visibleKpiIds.includes("sell") ? <div className="card">
          <h3>
            <CircleDollarSign size={14} />
            {t(props.language, "sigmaSell")}
          </h3>
          <div className="value">{money(props.tradesSummary.totalVerkauf)}</div>
        </div> : null}
        {visibleKpiIds.includes("capital") ? <div className="card">
          <h3>
            <HandCoins size={14} />
            {t(props.language, "openCapital")}
          </h3>
          <div className="value">{money(props.kpis.openCapital)}</div>
        </div> : null}
        {visibleKpiIds.includes("realized") ? <div className="card">
          <h3>
            <TrendingUp size={14} />
            {t(props.language, "realizedPL")}
          </h3>
          <div className={`value ${props.kpis.totalPL >= 0 ? "positive" : "negative"}`}>{money(props.kpis.totalPL)}</div>
        </div> : null}
      </section>

      {isMobile ? (
        <div className="trades-mobile-kpi-actions">
          <button className="secondary slim" type="button" onClick={() => setMobileShowAllKpis((prev) => !prev)}>
            {mobileShowAllKpis ? "Weniger Kennzahlen" : "Mehr Kennzahlen"}
          </button>
        </div>
      ) : null}

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
          <div className="card trades-filters-card overview-filters-card trades-filters-search-card">
            <label className="trades-single-search">
              <span className="label-with-icon">
                <Search size={13} />
                {t(props.language, "search")}
              </span>
              <input value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder={t(props.language, "searchPlaceholder")} />
            </label>
          </div>
          {!isMobile ? <div className="card trades-filters-card overview-filters-card trades-filters-card-main overview-filters-card-main">
            <div className="trades-filters-top-actions">
              <button type="button" className="secondary slim" onClick={props.onResetFilters}>
                {t(props.language, "reset")}
              </button>
            </div>
            <div className="trades-filters-grid">
              <label>
                {t(props.language, "status")}
                <div className="trades-status-switcher" role="tablist" aria-label={t(props.language, "status")}>
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`trades-status-switch trades-status-switch--icon-only ${props.statusFilter === option.value ? "is-active" : ""}`}
                      aria-label={option.label}
                      title={option.label}
                      onClick={() => props.onStatusFilterChange(option.value)}
                    >
                      <span className="trades-status-switch-content">
                        {option.icon}
                      </span>
                    </button>
                  ))}
                </div>
              </label>
              <label>
                {t(props.language, "type")}
                <select value={arrayToSingleSelect(props.typFilter)} onChange={(event) => props.onTypFilterChange(singleSelectToArray(event.target.value))}>
                  <option value="Alle">{t(props.language, "all")}</option>
                  {props.availableTypes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(props.language, "source")}
                <select
                  value={props.sourceFilter}
                  onChange={(event) => props.onSourceFilterChange(event.target.value as "Alle" | Trade["sourceBroker"])}
                >
                  <option value="Alle">{t(props.language, "all")}</option>
                  {props.availableSources.map((source) => (
                    <option key={source} value={source}>
                      {sourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(props.language, "basiswert")}
                <select
                  value={arrayToSingleSelect(props.basiswertFilter)}
                  onChange={(event) => props.onBasiswertFilterChange(singleSelectToArray(event.target.value))}
                >
                  <option value="Alle">{t(props.language, "all")}</option>
                  {props.availableBasiswerte.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(props.language, "range")}
                <select value={props.rangeFilter} onChange={(event) => props.onRangeFilterChange(event.target.value as "Alle" | "heute" | "7" | "30" | "monat" | "jahr" | "365")}>
                  <option value="Alle">{t(props.language, "all")}</option>
                  <option value="heute">Heute</option>
                  <option value="7">{t(props.language, "days7")}</option>
                  <option value="30">{t(props.language, "days30")}</option>
                  <option value="monat">Aktueller Monat</option>
                  <option value="jahr">Aktuelles Jahr</option>
                  <option value="365">{t(props.language, "days365")}</option>
                </select>
              </label>
            </div>
          </div> : null}
        </div>

        {!isMobile ? <div className="card trades-inline-calendar-card" onMouseUp={props.onCalendarMouseUp} onMouseLeave={props.onCalendarMouseUp}>
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
        </div> : null}
      </div>


      {isMobile ? (
        <div className="trades-mobile-cards-list">
          {props.filteredTrades.slice(0, 500).map((trade) => {
            const pl = getTradeRealizedPL(trade);
            const percent = trade.kaufPreis > 0 && isTradeClosed(trade) ? (pl / trade.kaufPreis) * 100 : null;
            return (
              <article key={trade.id} className="card trades-mobile-card">
                <button type="button" className="trades-mobile-card-main" onClick={() => props.onEditTrade(trade)}>
                  <div className="trades-mobile-card-head">
                    <span className={`trades-mobile-status ${isTradeClosed(trade) ? "closed" : "open"}`}>
                      {isTradeClosed(trade) ? t(props.language, "closed") : t(props.language, "open")}
                    </span>
                    <span className="trades-mobile-type">{trade.typ}</span>
                  </div>
                  <strong className="trades-mobile-name">{trade.name}</strong>
                  <div className="trades-mobile-basiswert">{trade.basiswert?.trim() ? trade.basiswert : "-"}</div>
                  <div className="trades-mobile-grid">
                    <span>Kauf: {money(trade.kaufPreis)}</span>
                    <span>Verkauf: {trade.verkaufPreis ? money(trade.verkaufPreis) : "-"}</span>
                    <span className={pl >= 0 ? "positive" : "negative"}>P&L: {trade.typ === "Steuerkorrektur" ? "-" : money(pl)}</span>
                    <span className={percent !== null && percent >= 0 ? "positive" : "negative"}>
                      Rendite: {percent !== null ? `${percent.toFixed(1)}%` : "-"}
                    </span>
                  </div>
                </button>
                <details className="trades-mobile-details">
                  <summary>Details</summary>
                  <div className="trades-mobile-details-content">
                    <div>ISIN: {trade.isin || "-"}</div>
                    <div>WKN: {trade.wkn || "-"}</div>
                    <div>Quelle: {sourceLabel(trade.sourceBroker)}</div>
                    <div>Steuern: {trade.verkaufSteuern !== undefined ? money(trade.verkaufSteuern) : "-"}</div>
                    <div>Kaufzeit: {formatDateTimeAT(trade.kaufzeitpunkt)}</div>
                    <div>Verkaufszeit: {formatDateTimeAT(["Steuerkorrektur", "Dividende", "Zinszahlung"].includes(trade.typ) ? trade.kaufzeitpunkt : trade.verkaufszeitpunkt)}</div>
                    <label className="trades-mobile-check">
                      <input
                        type="checkbox"
                        checked={!!trade.manualChecked}
                        onChange={(e) => props.onToggleTradeManualChecked(trade.id, e.target.checked)}
                      />
                      {t(props.language, "manualChecked")}
                    </label>
                    <button
                      type="button"
                      className="secondary slim danger-mobile"
                      onClick={() => props.onDeleteTrade(trade.id)}
                    >
                      {t(props.language, "delete")}
                    </button>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      ) : <div className="card">
        <div className="table-columns-controls">
          <button className="secondary slim" onClick={() => void copyVisibleTradesToClipboard()}>
            <Copy size={14} />
            {copyFeedback === "ok" ? "Kopiert" : copyFeedback === "error" ? "Fehler" : "Kopieren"}
          </button>
          <details className="actions-dropdown">
            <summary className="secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Layers size={14} />
              {t(props.language, "columns")}
              <ChevronDown size={14} />
            </summary>
            <div className="actions-dropdown-menu">
              {defaultOrder
                .filter((id) => !alwaysVisible.has(id))
                .map((id) => (
                  <label
                    key={id}
                    className="actions-dropdown-item"
                    style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 10 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={visibleById[id]}
                      onChange={() => setVisibleById((prev) => ({ ...prev, [id]: !prev[id] }))}
                    />
                    <span>{columnDefs[id].label}</span>
                  </label>
                ))}
            </div>
          </details>
        </div>

        <table>
          <thead>
            <tr>
              {renderedColumns.map((id) => {
                const def = columnDefs[id];
                const canDrag = def.draggable && !alwaysVisible.has(id);
                const sortableField = def.sortable as TradesSortField | undefined;
                return (
                  <th
                    key={id}
                    className={`${sortableField ? "sortable" : ""} ${id === "extern" ? "trader-col" : ""} ${
                      id === "kaufStueck" || id === "verkaufStueck" ? "piece-col" : ""
                    }`.trim()}
                    title={
                      id === "kaufStueck"
                        ? `${t(props.language, "buy")} ${t(props.language, "shares")}`
                        : id === "verkaufStueck"
                        ? `${t(props.language, "sell")} ${t(props.language, "shares")}`
                        : undefined
                    }
                    draggable={canDrag}
                    onDragStart={() => {
                      if (!canDrag) return;
                      didDragRef.current = false;
                      dragIdRef.current = id;
                    }}
                    onDragOver={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      const from = dragIdRef.current;
                      dragIdRef.current = null;
                      if (from && from !== id) reorderVisibleColumns(from, id);
                      didDragRef.current = true;
                      window.setTimeout(() => {
                        didDragRef.current = false;
                      }, 0);
                    }}
                    onClick={() => {
                      if (didDragRef.current) return;
                      if (sortableField) props.onToggleSort(sortableField);
                    }}
                  >
                    {def.label}
                    {sortableField ? props.sortMarker(sortableField) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {props.filteredTrades.slice(0, 500).map((trade) => (
              <tr key={trade.id} className="trades-row-open-edit" onClick={() => props.onEditTrade(trade)} title={t(props.language, "edit")}>
                {renderedColumns.map((id) => (
                  <td key={id} className={`${id === "extern" ? "trader-col" : ""} ${id === "kaufStueck" || id === "verkaufStueck" ? "piece-col" : ""}`.trim()}>
                    {columnDefs[id].render(trade)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {isMobile && mobileFilterOpen ? (
        <div className="trades-filter-panel-backdrop" onClick={() => setMobileFilterOpen(false)}>
          <div className="trades-filter-panel" onClick={(event) => event.stopPropagation()}>
            <div className="trades-filter-panel-header">
              <h3>Filter</h3>
              <button className="secondary slim" type="button" onClick={() => setMobileFilterOpen(false)}>
                Schließen
              </button>
            </div>
            <div className="trades-filter-panel-body">
              <label>
                Suche
                <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder={t(props.language, "searchPlaceholder")} />
              </label>
              <label>
                Status
                <div className="trades-status-switcher">
                  {statusOptions.map((option) => (
                    <button
                      key={`mobile-${option.value}`}
                      type="button"
                      className={`trades-status-switch trades-status-switch--icon-only ${draftStatusFilter === option.value ? "is-active" : ""}`}
                      aria-label={option.label}
                      title={option.label}
                      onClick={() => setDraftStatusFilter(option.value)}
                    >
                      <span className="trades-status-switch-content">
                        {option.icon}
                      </span>
                    </button>
                  ))}
                </div>
              </label>
              <label>
                Zeitraum
                <select value={draftRangeFilter} onChange={(event) => setDraftRangeFilter(event.target.value as typeof draftRangeFilter)}>
                  <option value="Alle">{t(props.language, "all")}</option>
                  <option value="heute">Heute</option>
                  <option value="7">{t(props.language, "days7")}</option>
                  <option value="30">{t(props.language, "days30")}</option>
                  <option value="monat">Aktueller Monat</option>
                  <option value="jahr">Aktuelles Jahr</option>
                  <option value="365">{t(props.language, "days365")}</option>
                </select>
              </label>
              <label>
                Quelle
                <select value={draftSourceFilter} onChange={(event) => setDraftSourceFilter(event.target.value as "Alle" | Trade["sourceBroker"])}>
                  <option value="Alle">{t(props.language, "all")}</option>
                  {props.availableSources.map((source) => (
                    <option key={`mobile-source-${source}`} value={source}>
                      {sourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="trades-filter-group">
                <h4>{t(props.language, "type")}</h4>
                <div className="trades-filter-scroll-list">
                  {props.availableTypes.map((value) => {
                    const selected = draftTypFilter.includes(value);
                    return (
                      <label key={`mobile-type-${value}`} className="trades-filter-check-row">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setDraftTypFilter((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]))
                          }
                        />
                        <span>{value}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="trades-filter-group">
                <h4>{t(props.language, "basiswert")}</h4>
                <div className="trades-filter-scroll-list">
                  {props.availableBasiswerte.map((value) => {
                    const selected = draftBasiswertFilter.includes(value);
                    return (
                      <label key={`mobile-basiswert-${value}`} className="trades-filter-check-row">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setDraftBasiswertFilter((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]))
                          }
                        />
                        <span>{value}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="trades-filter-panel-footer">
              <button className="secondary" type="button" onClick={resetMobileFilters}>
                Zurücksetzen
              </button>
              <button className="primary" type="button" onClick={applyMobileFilters}>
                Anwenden ({props.filteredTrades.length})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && !mobileFilterOpen ? (
        <div className="trades-mobile-sticky-bar" role="toolbar" aria-label={t(props.language, "tradesTitle")}>
          <button className="secondary trades-mobile-sticky-bar-filter" type="button" onClick={() => setMobileFilterOpen(true)}>
            <Filter size={18} aria-hidden />
            <span>{t(props.language, "importStep4FilterLabel")}</span>
            {activeFilterCount > 0 ? <span className="trades-filter-count-badge">{activeFilterCount}</span> : null}
          </button>
          <button className="primary trades-mobile-sticky-bar-new" type="button" onClick={props.onGoToNewTrade}>
            <Plus size={18} aria-hidden />
            {t(props.language, "newTrade")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
