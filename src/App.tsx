import { useEffect, useMemo, useState } from "react";
import type { Trade } from "./types/trade";
import { getKpis, getTradeRealizedPL, isTradeClosed, money } from "./lib/analytics";
import { saveTradesToStorage } from "./lib/storage";
import { parseTradesCsv } from "./lib/csv";
import { EquityCurve } from "./components/EquityCurve";
import { PageHeader } from "./components/PageHeader";
import { calendarMonthNames, calendarWeekdayNames } from "./app/constants";
import {
  daysBetween,
  formatDashboardDateTime,
  formatDateTimeAT,
  formatMonthLabel,
  getNowLocalDateTimeValue,
  parseStoredDateTime,
  toDisplayDateTime,
  toIsoMonth,
  toLocalInputValue
} from "./app/date";
import { csvEscape, readInitialTrades } from "./app/helpers";
import { buildAnalyticsData, buildAssetRows, buildDashboardMonthlyStats, buildDashboardTopFlop } from "./app/derive";
import {
  type AssetSortField,
  type DashboardOpenSortField,
  defaultForm,
  type NewTradeForm,
  type SortDirection,
  type TradeFormType,
  type TradesSortField,
  type View
} from "./app/types";
import {
  BarChart3,
  Briefcase,
  CandlestickChart,
  ChartColumn,
  CircleDollarSign,
  Clock3,
  Database,
  FileDown,
  HandCoins,
  Layers,
  LayoutDashboard,
  LineChart,
  Percent,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  CheckCircle2,
  Circle,
  TrendingDown,
  TrendingUp,
  X
} from "lucide-react";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [trades, setTrades] = useState<Trade[]>(() => readInitialTrades());
  const [form, setForm] = useState<NewTradeForm>(defaultForm());
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Alle" | Trade["status"]>("Alle");
  const [typFilter, setTypFilter] = useState<"Alle" | string>("Alle");
  const [basiswertFilter, setBasiswertFilter] = useState<"Alle" | string>("Alle");
  const [rangeFilter, setRangeFilter] = useState<"Alle" | "7" | "30" | "90" | "365">("Alle");
  const [sortField, setSortField] = useState<TradesSortField>("kauf");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarRangeStart, setCalendarRangeStart] = useState<string | null>(null);
  const [calendarRangeEnd, setCalendarRangeEnd] = useState<string | null>(null);
  const [calendarIsDragging, setCalendarIsDragging] = useState(false);
  const [calendarDragMoved, setCalendarDragMoved] = useState(false);
  const [dashboardOpenSortField, setDashboardOpenSortField] = useState<DashboardOpenSortField>("kaufPreis");
  const [dashboardOpenSortDirection, setDashboardOpenSortDirection] = useState<SortDirection>("desc");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("Alle");
  const [assetSortField, setAssetSortField] = useState<AssetSortField>("name");
  const [assetSortDirection, setAssetSortDirection] = useState<SortDirection>("asc");
  const [selectedImportFileName, setSelectedImportFileName] = useState("Keine Datei ausgewählt");
  const [analyticsTab, setAnalyticsTab] = useState<"overview" | "timing" | "assets">("overview");
  const [dashboardNow, setDashboardNow] = useState(() => new Date());

  const kpis = useMemo(() => getKpis(trades), [trades]);
  useEffect(() => {
    const timer = window.setInterval(() => setDashboardNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const dashboardOpenPositions = useMemo(
    () =>
      [...trades.filter((trade) => !isTradeClosed(trade))].sort((a, b) => {
        let av: string | number = "";
        let bv: string | number = "";
        switch (dashboardOpenSortField) {
          case "name":
            av = a.name.toLowerCase();
            bv = b.name.toLowerCase();
            break;
          case "typ":
            av = a.typ.toLowerCase();
            bv = b.typ.toLowerCase();
            break;
          case "basiswert":
            av = a.basiswert.toLowerCase();
            bv = b.basiswert.toLowerCase();
            break;
          case "kaufzeitpunkt":
            av = parseStoredDateTime(a.kaufzeitpunkt)?.getTime() ?? 0;
            bv = parseStoredDateTime(b.kaufzeitpunkt)?.getTime() ?? 0;
            break;
          case "kaufPreis":
            av = a.kaufPreis ?? 0;
            bv = b.kaufPreis ?? 0;
            break;
          case "stueck":
            av = a.stueck ?? 0;
            bv = b.stueck ?? 0;
            break;
        }
        if (av < bv) return dashboardOpenSortDirection === "asc" ? -1 : 1;
        if (av > bv) return dashboardOpenSortDirection === "asc" ? 1 : -1;
        return 0;
      }),
    [trades, dashboardOpenSortField, dashboardOpenSortDirection]
  );
  const dashboardMonthlyStats = useMemo(() => buildDashboardMonthlyStats(trades), [trades]);
  const dashboardTopFlop = useMemo(() => buildDashboardTopFlop(trades), [trades]);
  const analyticsData = useMemo(() => buildAnalyticsData(trades), [trades]);
  const availableTypes = useMemo(
    () => ["Alle", ...new Set(trades.map((trade) => trade.typ).filter(Boolean))],
    [trades]
  );
  const availableBasiswerte = useMemo(
    () => ["Alle", ...new Set(trades.map((trade) => trade.basiswert).filter(Boolean))],
    [trades]
  );

  const baseFilteredTrades = useMemo(() => {
    const searchNormalized = search.trim().toLowerCase();
    return trades.filter((trade) => {
      const matchesSearch =
        !searchNormalized ||
        trade.name.toLowerCase().includes(searchNormalized) ||
        trade.basiswert.toLowerCase().includes(searchNormalized);

      const matchesStatus = statusFilter === "Alle" || trade.status === statusFilter;
      const matchesTyp = typFilter === "Alle" || trade.typ === typFilter;
      const matchesBasiswert = basiswertFilter === "Alle" || trade.basiswert === basiswertFilter;
      return matchesSearch && matchesStatus && matchesTyp && matchesBasiswert;
    });
  }, [trades, search, statusFilter, typFilter, basiswertFilter]);

  const filteredTrades = useMemo(() => {
    const now = new Date();
    const dateRangeStart = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart < calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeStart;
    const dateRangeEnd = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart > calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeEnd;
    const base = baseFilteredTrades.filter((trade) => {
      const tradeDate = parseStoredDateTime(trade.kaufzeitpunkt);
      const matchesRange =
        rangeFilter === "Alle" ||
        (tradeDate !== null &&
          now.getTime() - tradeDate.getTime() <= Number.parseInt(rangeFilter, 10) * 24 * 60 * 60 * 1000);
      if (!matchesRange) return false;
      if (!dateRangeStart || !dateRangeEnd) return true;
      if (!tradeDate) return false;
      const key = `${tradeDate.getFullYear()}-${`${tradeDate.getMonth() + 1}`.padStart(2, "0")}-${`${tradeDate.getDate()}`.padStart(2, "0")}`;
      return key >= dateRangeStart && key <= dateRangeEnd;
    });

    return [...base].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "kauf":
          av = parseStoredDateTime(a.kaufzeitpunkt)?.getTime() ?? 0;
          bv = parseStoredDateTime(b.kaufzeitpunkt)?.getTime() ?? 0;
          break;
        case "verkauf":
          av = parseStoredDateTime(a.verkaufszeitpunkt)?.getTime() ?? 0;
          bv = parseStoredDateTime(b.verkaufszeitpunkt)?.getTime() ?? 0;
          break;
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "typ":
          av = a.typ.toLowerCase();
          bv = b.typ.toLowerCase();
          break;
        case "kaufPreis":
          av = a.kaufPreis ?? 0;
          bv = b.kaufPreis ?? 0;
          break;
        case "verkaufPreis":
          av = a.verkaufPreis ?? 0;
          bv = b.verkaufPreis ?? 0;
          break;
        case "gewinn":
          av = getTradeRealizedPL(a);
          bv = getTradeRealizedPL(b);
          break;
      }

      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [baseFilteredTrades, rangeFilter, calendarRangeStart, calendarRangeEnd, sortField, sortDirection]);

  const tradesSummary = useMemo(() => {
    const totalKauf = filteredTrades.reduce((sum, trade) => sum + (trade.kaufPreis ?? 0), 0);
    const totalVerkauf = filteredTrades.reduce((sum, trade) => sum + (trade.verkaufPreis ?? 0), 0);
    const totalGewinn = filteredTrades.reduce((sum, trade) => sum + getTradeRealizedPL(trade), 0);
    const winners = filteredTrades.filter((trade) => getTradeRealizedPL(trade) > 0).length;
    const losers = filteredTrades.filter((trade) => getTradeRealizedPL(trade) < 0).length;
    return { totalKauf, totalVerkauf, totalGewinn, winners, losers };
  }, [filteredTrades]);
  const tradesCalendarMap = useMemo(() => {
    const map = new Map<string, Trade[]>();
    baseFilteredTrades.forEach((trade) => {
      const date = parseStoredDateTime(trade.kaufzeitpunkt);
      if (!date || date.getFullYear() !== calendarMonth.getFullYear() || date.getMonth() !== calendarMonth.getMonth()) return;
      const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
      const bucket = map.get(key) ?? [];
      bucket.push(trade);
      map.set(key, bucket);
    });
    return map;
  }, [baseFilteredTrades, calendarMonth]);

  const assetRows = useMemo(() => buildAssetRows(trades), [trades]);

  const assetCategories = useMemo(
    () => ["Alle", ...new Set(assetRows.map((row) => row.category))],
    [assetRows]
  );

  const filteredAssets = useMemo(() => {
    const normalizedSearch = assetSearch.trim().toLowerCase();
    const base = assetRows.filter((row) => {
      const matchSearch = !normalizedSearch || row.name.toLowerCase().includes(normalizedSearch);
      const matchCategory = assetCategoryFilter === "Alle" || row.category === assetCategoryFilter;
      return matchSearch && matchCategory;
    });

    return [...base].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (assetSortField) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "category":
          av = a.category.toLowerCase();
          bv = b.category.toLowerCase();
          break;
        case "tradesCount":
          av = a.tradesCount;
          bv = b.tradesCount;
          break;
        case "realizedPL":
          av = a.realizedPL;
          bv = b.realizedPL;
          break;
        case "openCapital":
          av = a.openCapital;
          bv = b.openCapital;
          break;
      }
      if (av < bv) return assetSortDirection === "asc" ? -1 : 1;
      if (av > bv) return assetSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [assetRows, assetSearch, assetCategoryFilter, assetSortField, assetSortDirection]);

  const assetSummary = useMemo(() => {
    const totalAssets = filteredAssets.length;
    const withOpen = filteredAssets.filter((row) => row.hasOpen).length;
    const totalPL = filteredAssets.reduce((sum, row) => sum + row.realizedPL, 0);
    const categoryCount = filteredAssets.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] ?? 0) + 1;
      return acc;
    }, {});
    return { totalAssets, withOpen, totalPL, categoryCount };
  }, [filteredAssets]);

  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseTradesCsv(text);
    setTrades(rows);
    saveTradesToStorage(rows);
    setSelectedImportFileName(file.name);
  };

  const kaufPreis = Number.parseFloat(form.kaufPreis) || 0;
  const verkaufPreis = Number.parseFloat(form.verkaufPreis) || 0;
  const statusClosed = form.status === "Geschlossen";
  const gewinn = statusClosed ? verkaufPreis - kaufPreis : 0;
  const rendite = kaufPreis > 0 ? (gewinn / kaufPreis) * 100 : 0;
  const haltedauer = statusClosed ? daysBetween(form.kaufzeitpunkt, form.verkaufszeitpunkt) : 0;
  const monat = statusClosed ? toIsoMonth(form.verkaufszeitpunkt) : toIsoMonth(form.kaufzeitpunkt);

  const saveNewTrade = () => {
    if (!form.name.trim() || !form.basiswert.trim() || !form.kaufzeitpunkt || kaufPreis <= 0) return;

    const next: Trade = {
      id: editingTradeId ?? `trade-${Date.now()}`,
      name: form.name.trim(),
      typ: form.typ,
      basiswert: form.basiswert.trim(),
      kaufzeitpunkt: toDisplayDateTime(form.kaufzeitpunkt),
      kaufPreis,
      stueck: form.stueck ? Number.parseFloat(form.stueck) : undefined,
      verkaufszeitpunkt: statusClosed ? toDisplayDateTime(form.verkaufszeitpunkt) : undefined,
      verkaufPreis: statusClosed ? verkaufPreis : undefined,
      gewinn: statusClosed ? gewinn : undefined,
      status: form.status
    };

    const updated = editingTradeId
      ? trades.map((trade) => (trade.id === editingTradeId ? next : trade))
      : [next, ...trades];
    setTrades(updated);
    saveTradesToStorage(updated);
    setForm(defaultForm());
    setEditingTradeId(null);
    setView("trades");
  };

  const toggleSort = (field: TradesSortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "name" || field === "typ" ? "asc" : "desc");
  };

  const sortMarker = (field: TradesSortField) =>
    sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕";

  const exportTradesCsvForExcel = () => {
    const header = [
      "tradeId",
      "name",
      "typ",
      "basiswert",
      "kaufzeitpunkt",
      "kaufPreis",
      "stueck",
      "verkaufszeitpunkt",
      "verkaufPreis",
      "gewinn",
      "status"
    ];
    const rows = trades.map((trade) => [
      trade.id,
      trade.name,
      trade.typ,
      trade.basiswert,
      trade.kaufzeitpunkt,
      trade.kaufPreis,
      trade.stueck,
      trade.verkaufszeitpunkt,
      trade.verkaufPreis,
      trade.gewinn,
      trade.status
    ]);
    const csvBody = [header, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(";"))
      .join("\r\n");

    const csv = `\uFEFFsep=;\r\n${csvBody}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trades-export-excel.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportTradesJsonBackup = () => {
    const json = JSON.stringify(trades, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trades-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteTrade = (id: string) => {
    const updated = trades.filter((trade) => trade.id !== id);
    setTrades(updated);
    saveTradesToStorage(updated);
    if (editingTradeId === id) {
      setEditingTradeId(null);
      setForm(defaultForm());
    }
  };

  const editTrade = (trade: Trade) => {
    setEditingTradeId(trade.id);
    setForm({
      name: trade.name,
      typ: trade.typ,
      basiswert: trade.basiswert,
      kaufzeitpunkt: toLocalInputValue(trade.kaufzeitpunkt),
      kaufPreis: `${trade.kaufPreis ?? 0}`,
      stueck: trade.stueck !== undefined ? `${trade.stueck}` : "",
      status: isTradeClosed(trade) ? "Geschlossen" : "Offen",
      verkaufszeitpunkt: toLocalInputValue(trade.verkaufszeitpunkt),
      verkaufPreis: trade.verkaufPreis !== undefined ? `${trade.verkaufPreis}` : ""
    });
    setView("newTrade");
  };

  const openTradesWithOpenFilter = () => {
    setStatusFilter("Offen");
    setView("trades");
  };
  const openAnalyticsOverview = () => {
    setAnalyticsTab("overview");
    setView("analytics");
  };
  const jumpToAsset = (assetName: string) => {
    setAssetCategoryFilter("Alle");
    setAssetSearch(assetName);
    setView("assets");
  };

  const toggleAssetSort = (field: AssetSortField) => {
    if (assetSortField === field) {
      setAssetSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setAssetSortField(field);
    setAssetSortDirection(field === "name" || field === "category" ? "asc" : "desc");
  };

  const assetSortMarker = (field: AssetSortField) =>
    assetSortField === field ? (assetSortDirection === "asc" ? " ↑" : " ↓") : " ↕";
  const toggleDashboardOpenSort = (field: DashboardOpenSortField) => {
    if (dashboardOpenSortField === field) {
      setDashboardOpenSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setDashboardOpenSortField(field);
    setDashboardOpenSortDirection(field === "name" || field === "typ" || field === "basiswert" ? "asc" : "desc");
  };
  const dashboardOpenSortMarker = (field: DashboardOpenSortField) =>
    dashboardOpenSortField === field ? (dashboardOpenSortDirection === "asc" ? " ↑" : " ↓") : " ↕";
  const currentCalendarYear = calendarMonth.getFullYear();
  const currentCalendarMonth = calendarMonth.getMonth();
  const firstDayOfCalendarMonth = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const daysInCalendarMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const calendarStartOffset = (firstDayOfCalendarMonth.getDay() + 6) % 7;
  const calendarCells = Array.from(
    { length: calendarStartOffset + daysInCalendarMonth },
    (_, idx) => idx - calendarStartOffset + 1
  );
  const calendarRangeMin =
    calendarRangeStart && calendarRangeEnd
      ? (calendarRangeStart < calendarRangeEnd ? calendarRangeStart : calendarRangeEnd)
      : calendarRangeStart;
  const calendarRangeMax =
    calendarRangeStart && calendarRangeEnd
      ? (calendarRangeStart > calendarRangeEnd ? calendarRangeStart : calendarRangeEnd)
      : calendarRangeEnd;
  const calendarMonthLabel = `${calendarMonthNames[currentCalendarMonth]} ${currentCalendarYear}`;
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
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
    if (calendarRangeStart && dateKey !== calendarRangeStart) {
      setCalendarDragMoved(true);
    }
    setCalendarRangeEnd(dateKey);
  };
  const handleCalendarMouseUp = () => setCalendarIsDragging(false);
  const clearCalendarFilter = () => {
    setCalendarRangeStart(null);
    setCalendarRangeEnd(null);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Trading Dashboard</div>
        <div className="menu">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><LayoutDashboard size={15} />Dashboard</button>
          <button className={view === "trades" ? "active" : ""} onClick={() => setView("trades")}><CandlestickChart size={15} />Trades</button>
          <button className={view === "assets" ? "active" : ""} onClick={() => setView("assets")}><Database size={15} />Basiswerte</button>
          <button className={view === "analytics" ? "active" : ""} onClick={() => setView("analytics")}><BarChart3 size={15} />Auswertungen</button>
        </div>
      </aside>

      <main className="content">
        {view === "dashboard" && (
          <>
            <PageHeader
              className="dashboard-header"
              title={<><LayoutDashboard size={18} />Trading Dashboard</>}
              subtitle="Überblick über deine Trading-Performance"
            />

            <section className="section dashboard-link-grid">
              <button className="card dashboard-link-card" onClick={openAnalyticsOverview}>
                <h3><TrendingUp size={14} />Realisierter P&L</h3>
                <div className={`value ${kpis.totalPL >= 0 ? "positive" : "negative"}`}>{money(kpis.totalPL)}</div>
                <p>Zu Auswertungen</p>
              </button>
              <button className="card dashboard-link-card" onClick={openTradesWithOpenFilter}>
                <h3><Layers size={14} />Offene Positionen</h3>
                <div className="value">{kpis.openTrades}</div>
                <p>Zu Trades (Status: Offen)</p>
              </button>
              <button className="card dashboard-link-card" onClick={openTradesWithOpenFilter}>
                <h3><HandCoins size={14} />Offenes Kapital</h3>
                <div className="value">{money(kpis.openCapital)}</div>
                <p>Zu offenen Positionen</p>
              </button>
              <div className="card dashboard-link-card dashboard-clock-card" role="status" aria-live="polite">
                <h3><Clock3 size={14} />Datum & Uhrzeit</h3>
                <div className="value">{formatDashboardDateTime(dashboardNow)}</div>
                <p>Aktualisiert in Echtzeit</p>
              </div>
            </section>

            <section className="section">
              <EquityCurve trades={trades} />
            </section>

            <section className="section card">
              <div className="dashboard-section-head">
                <h3>Offene Positionen ({dashboardOpenPositions.length})</h3>
                <button className="secondary slim" onClick={openTradesWithOpenFilter}>Alle anzeigen</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleDashboardOpenSort("name")} className="sortable">Name{dashboardOpenSortMarker("name")}</th>
                    <th onClick={() => toggleDashboardOpenSort("typ")} className="sortable">Typ{dashboardOpenSortMarker("typ")}</th>
                    <th onClick={() => toggleDashboardOpenSort("basiswert")} className="sortable">Basiswert{dashboardOpenSortMarker("basiswert")}</th>
                    <th onClick={() => toggleDashboardOpenSort("kaufzeitpunkt")} className="sortable">Kaufdatum{dashboardOpenSortMarker("kaufzeitpunkt")}</th>
                    <th onClick={() => toggleDashboardOpenSort("kaufPreis")} className="sortable">Investiert{dashboardOpenSortMarker("kaufPreis")}</th>
                    <th onClick={() => toggleDashboardOpenSort("stueck")} className="sortable">Stück{dashboardOpenSortMarker("stueck")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardOpenPositions.slice(0, 10).map((trade) => (
                    <tr key={`open-${trade.id}`} className="dashboard-open-row" onClick={() => editTrade(trade)}>
                      <td>{trade.name}</td>
                      <td>{trade.typ}</td>
                      <td>{trade.basiswert}</td>
                      <td>{formatDateTimeAT(trade.kaufzeitpunkt)}</td>
                      <td>{money(trade.kaufPreis ?? 0)}</td>
                      <td>{trade.stueck ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dashboardOpenPositions.length > 10 && (
                <p className="dashboard-more-link">+{dashboardOpenPositions.length - 10} weitere offene Trades anzeigen</p>
              )}
            </section>

            <section className="section dashboard-bottom-grid">
              <div className="card">
                <h3>Monats-P&L</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th># Trades</th>
                      <th>P&L</th>
                      <th>Win-Rate</th>
                      <th>Kumulativ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardMonthlyStats.map((m) => (
                      <tr key={m.month}>
                        <td>{formatMonthLabel(m.month)}</td>
                        <td>{m.trades}</td>
                        <td className={m.pl >= 0 ? "positive" : "negative"}>{money(m.pl)}</td>
                        <td>{m.winRate.toFixed(1)}%</td>
                        <td className={m.cumulative >= 0 ? "positive" : "negative"}>{money(m.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3>Top & Flop Basiswerte</h3>
                <div className="topflop-block">
                  <h4 className="positive">Top 5 Gewinner</h4>
                  {dashboardTopFlop.top.map(([asset, pl]) => (
                    <div key={`top-${asset}`} className="topflop-row top">
                      <button className="asset-jump-link" onClick={() => jumpToAsset(asset)}>{asset}</button>
                      <span>{money(pl)}</span>
                    </div>
                  ))}
                </div>
                <div className="topflop-block">
                  <h4 className="negative">Top 5 Verlierer</h4>
                  {dashboardTopFlop.flop.map(([asset, pl]) => (
                    <div key={`flop-${asset}`} className="topflop-row flop">
                      <button className="asset-jump-link" onClick={() => jumpToAsset(asset)}>{asset}</button>
                      <span>{money(pl)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {view === "trades" && (
          <section className="section trades-page">
            <PageHeader
              title={<><CandlestickChart size={18} />Trades</>}
              subtitle={`${filteredTrades.length} von ${trades.length} Trades`}
              actions={
                <>
                <input
                  id="trades-import-input"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importCsv(file);
                  }}
                />
                <label htmlFor="trades-import-input" className="primary file-pick-btn">
                  <FileDown size={14} />
                  Import
                </label>
                <button className="secondary" onClick={exportTradesCsvForExcel}><FileDown size={14} />CSV Export (Excel)</button>
                <button className="secondary" onClick={exportTradesJsonBackup}><FileDown size={14} />JSON Backup</button>
                <button className="primary new-trade-cta" onClick={() => setView("newTrade")}><Plus size={14} />Neuer Trade</button>
                </>
              }
            />

            <section className="kpis trades-kpis">
              <div className="card">
                <h3><Briefcase size={14} />Trades gesamt</h3>
                <div className="value">{kpis.totalTrades}</div>
              </div>
              <div className="card">
                <h3><Layers size={14} />Offene Positionen</h3>
                <div className="value">{kpis.openTrades}</div>
              </div>
              <div className="card">
                <h3><TrendingUp size={14} />Gewinner</h3>
                <div className="value positive">{tradesSummary.winners}</div>
              </div>
              <div className="card">
                <h3><TrendingDown size={14} />Verlierer</h3>
                <div className="value negative">{tradesSummary.losers}</div>
              </div>
            </section>

            <div className="trades-summary-grid trades-summary-grid-spaced">
              <div className="card"><h3><CircleDollarSign size={14} />Σ Kauf</h3><div className="value">{money(tradesSummary.totalKauf)}</div></div>
              <div className="card"><h3><CircleDollarSign size={14} />Σ Verkauf</h3><div className="value">{money(tradesSummary.totalVerkauf)}</div></div>
              <div className="card"><h3><HandCoins size={14} />Offenes Kapital</h3><div className="value">{money(kpis.openCapital)}</div></div>
              <div className="card"><h3><TrendingUp size={14} />Realisierter P&L</h3><div className={`value ${kpis.totalPL >= 0 ? "positive" : "negative"}`}>{money(kpis.totalPL)}</div></div>
            </div>

            <div className="trades-controls-layout">
              <div className="trades-controls-main">
                <div className="card trades-filters-card trades-filters-search-card">
                  <label className="trades-single-search">
                    <span className="label-with-icon"><Search size={13} />Suche</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Basiswert..." />
                  </label>
                </div>

                <div className="card trades-filters-card trades-filters-card-main">
                  <div className="trades-filters-grid">
                    <label>
                      Status
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "Alle" | Trade["status"])}>
                        <option value="Alle">Alle</option>
                        <option value="Offen">Offen</option>
                        <option value="Geschlossen">Geschlossen</option>
                      </select>
                    </label>
                    <label>
                      Typ
                      <select value={typFilter} onChange={(event) => setTypFilter(event.target.value)}>
                        {availableTypes.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Basiswert
                      <select value={basiswertFilter} onChange={(event) => setBasiswertFilter(event.target.value)}>
                        {availableBasiswerte.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Zeitraum
                      <select
                        value={rangeFilter}
                        onChange={(event) => {
                          setRangeFilter(event.target.value as "Alle" | "7" | "30" | "90" | "365");
                          setCalendarRangeStart(null);
                          setCalendarRangeEnd(null);
                        }}
                      >
                        <option value="Alle">Alle</option>
                        <option value="7">7 Tage</option>
                        <option value="30">30 Tage</option>
                        <option value="90">90 Tage</option>
                        <option value="365">365 Tage</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="card trades-inline-calendar-card" onMouseUp={handleCalendarMouseUp} onMouseLeave={handleCalendarMouseUp}>
                <div className="trades-inline-calendar-head">
                  <button className="secondary slim" onClick={() => setCalendarMonth(new Date(currentCalendarYear, currentCalendarMonth - 1, 1))}>◀</button>
                  <strong>{calendarMonthLabel}</strong>
                  <button className="secondary slim" onClick={() => setCalendarMonth(new Date(currentCalendarYear, currentCalendarMonth + 1, 1))}>▶</button>
                  <button className="secondary slim" onClick={clearCalendarFilter}>Reset</button>
                </div>
                <div className="month-weekdays inline">
                  {calendarWeekdayNames.map((weekday) => (
                    <span key={`inline-${weekday}`}>{weekday}</span>
                  ))}
                </div>
                <div className="month-days inline">
                  {calendarCells.map((day, idx) => {
                    if (day < 1) {
                      return <div key={`inline-empty-${idx}`} className="day-cell empty" />;
                    }
                    const key = toDateKey(new Date(currentCalendarYear, currentCalendarMonth, day));
                    const tradesForDay = tradesCalendarMap.get(key) ?? [];
                    const inRange = !!(calendarRangeMin && calendarRangeMax && key >= calendarRangeMin && key <= calendarRangeMax);
                    const isBoundary = key === calendarRangeStart || key === calendarRangeEnd;
                    return (
                      <button
                        key={`inline-${key}`}
                        type="button"
                        className={`day-cell inline ${inRange ? "in-range" : ""} ${isBoundary ? "range-boundary" : ""}`}
                        title={`${key}: ${tradesForDay.length} Trade(s)`}
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
                          {tradesForDay.slice(0, 4).map((trade) => (
                            <span
                              key={`inline-icon-${trade.id}`}
                              className={`day-trade-icon ${isTradeClosed(trade) ? "closed" : "open"}`}
                            />
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
                    <th onClick={() => toggleSort("kauf")} className="sortable">Kauf{sortMarker("kauf")}</th>
                    <th onClick={() => toggleSort("verkauf")} className="sortable">Verkauf{sortMarker("verkauf")}</th>
                    <th onClick={() => toggleSort("name")} className="sortable">Name{sortMarker("name")}</th>
                    <th onClick={() => toggleSort("typ")} className="sortable">Typ{sortMarker("typ")}</th>
                    <th>Basiswert</th>
                    <th onClick={() => toggleSort("kaufPreis")} className="sortable">Kauf EUR{sortMarker("kaufPreis")}</th>
                    <th onClick={() => toggleSort("verkaufPreis")} className="sortable">Verkauf EUR{sortMarker("verkaufPreis")}</th>
                    <th onClick={() => toggleSort("gewinn")} className="sortable">Gewinn{sortMarker("gewinn")}</th>
                    <th>%</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.slice(0, 500).map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        {isTradeClosed(trade) ? (
                          <CheckCircle2 size={16} className="status-icon closed" />
                        ) : (
                          <Circle size={16} className="status-icon open" />
                        )}
                      </td>
                      <td>{formatDateTimeAT(trade.kaufzeitpunkt)}</td>
                      <td>{formatDateTimeAT(trade.verkaufszeitpunkt)}</td>
                      <td>{trade.name}</td>
                      <td>{trade.typ}</td>
                      <td>{trade.basiswert}</td>
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
                          <button className="icon-btn action edit" title="Bearbeiten" onClick={() => editTrade(trade)}>
                            <Pencil size={13} />
                          </button>
                          <button className="icon-btn action delete" title="Löschen" onClick={() => deleteTrade(trade.id)}>
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
        )}

        {view === "newTrade" && (
          <section className="section new-trade">
            <PageHeader
              title={editingTradeId ? "Trade bearbeiten" : "Neuer Trade"}
              subtitle={editingTradeId ? "Bearbeite den ausgewählten Trade" : "Erfasse einen neuen Trade"}
              actions={
                <button className="secondary" onClick={() => setView("trades")}>
                  <CandlestickChart size={14} />
                  Zu Trades
                </button>
              }
            />

            <div className="new-trade-grid">
              <div className="card form-card">
                <h3>Grunddaten</h3>
                <div className="form-grid">
                  <label>
                    Name *
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="z.B. Gold - Long 4500"
                    />
                  </label>
                  <label>
                    Typ *
                    <select
                      value={form.typ}
                      onChange={(e) => setForm((prev) => ({ ...prev, typ: e.target.value as TradeFormType }))}
                    >
                      <option value="Long">Long</option>
                      <option value="Short">Short</option>
                      <option value="Aktie">Aktie</option>
                      <option value="Anleihe">Anleihe</option>
                      <option value="Fond">Fond</option>
                      <option value="Derivat">Derivat</option>
                      <option value="Dividende">Dividende</option>
                      <option value="Zinszahlung">Zinszahlung</option>
                      <option value="Steuerkorrektur">Steuerkorrektur</option>
                    </select>
                  </label>
                  <label>
                    Basiswert *
                    <input
                      value={form.basiswert}
                      onChange={(e) => setForm((prev) => ({ ...prev, basiswert: e.target.value }))}
                      placeholder="z.B. Gold, Microsoft"
                    />
                  </label>
                  <label>
                    Kaufzeitpunkt *
                    <div className="date-input-row">
                      <input
                        type="datetime-local"
                        value={form.kaufzeitpunkt}
                        onChange={(e) => setForm((prev) => ({ ...prev, kaufzeitpunkt: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        title="Aktuelle Zeit übernehmen"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            kaufzeitpunkt: getNowLocalDateTimeValue()
                          }))
                        }
                      >
                        <Clock3 size={14} />
                      </button>
                    </div>
                  </label>
                  <label>
                    Kaufpreis (EUR) *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.kaufPreis}
                      onChange={(e) => setForm((prev) => ({ ...prev, kaufPreis: e.target.value }))}
                      placeholder="0,00"
                    />
                  </label>
                  <label>
                    Stueck
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form.stueck}
                      onChange={(e) => setForm((prev) => ({ ...prev, stueck: e.target.value }))}
                      placeholder="Anzahl (optional)"
                    />
                  </label>
                </div>
              </div>

              <div className="card form-card">
                <div className="form-title-row">
                  <h3>Verkauf / Abschluss</h3>
                  <button
                    className="ghost-btn"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        status: prev.status === "Offen" ? "Geschlossen" : "Offen",
                        verkaufszeitpunkt:
                          prev.status === "Offen" && !prev.verkaufszeitpunkt
                            ? getNowLocalDateTimeValue()
                            : prev.verkaufszeitpunkt
                      }))
                    }
                  >
                    {statusClosed ? "Wieder öffnen" : "Jetzt schließen"}
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    Status
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Trade["status"] }))}
                    >
                      <option value="Offen">Offen</option>
                      <option value="Geschlossen">Geschlossen</option>
                    </select>
                  </label>
                  <label>
                    Verkaufszeitpunkt
                    <div className="date-input-row">
                      <input
                        type="datetime-local"
                        value={form.verkaufszeitpunkt}
                        onChange={(e) => setForm((prev) => ({ ...prev, verkaufszeitpunkt: e.target.value }))}
                        disabled={!statusClosed}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        title="Aktuelle Zeit übernehmen"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            verkaufszeitpunkt: getNowLocalDateTimeValue()
                          }))
                        }
                        disabled={!statusClosed}
                      >
                        <Clock3 size={14} />
                      </button>
                    </div>
                  </label>
                  <label>
                    Verkaufspreis (EUR)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.verkaufPreis}
                      onChange={(e) => setForm((prev) => ({ ...prev, verkaufPreis: e.target.value }))}
                      placeholder="0,00"
                      disabled={!statusClosed}
                    />
                  </label>
                  <label>
                    Gewinn (EUR)
                    <input value={money(gewinn)} disabled />
                  </label>
                  <label>
                    Rendite (%)
                    <input value={`${rendite.toFixed(2)}%`} disabled />
                  </label>
                  <label>
                    Haltedauer (Tage)
                    <input value={`${haltedauer}`} disabled />
                  </label>
                  <label>
                    Monat
                    <input value={monat} disabled />
                  </label>
                </div>
              </div>
            </div>

            <div className="new-trade-actions">
              <button className="primary" onClick={saveNewTrade}>{editingTradeId ? "Änderungen speichern" : "Speichern"}</button>
              <button
                className="secondary"
                onClick={() => {
                  setForm(defaultForm());
                  setEditingTradeId(null);
                }}
              >
                Abbrechen
              </button>
            </div>
          </section>
        )}

        {view === "assets" && (
          <section className="section">
            <PageHeader
              title={<><Database size={18} />Basiswerte / Assets</>}
              subtitle="Alle in den Daten vorhandenen Basiswerte mit Kennzahlen"
              actions={<button className="primary" onClick={() => setView("newTrade")}><Plus size={14} />Neuer Basiswert</button>}
            />

            <div className="trades-summary-grid">
              <div className="card"><h3>Basiswerte gesamt</h3><div className="value">{assetSummary.totalAssets}</div></div>
              <div className="card"><h3>Mit offenen Positionen</h3><div className="value">{assetSummary.withOpen}</div></div>
              <div className="card"><h3>Realisierter P&L</h3><div className={`value ${assetSummary.totalPL >= 0 ? "positive" : "negative"}`}>{money(assetSummary.totalPL)}</div></div>
              <div className="card assets-category-card">
                <h3>Nach Kategorie</h3>
                <div className="assets-category-tags">
                  {Object.entries(assetSummary.categoryCount).map(([category, count]) => (
                    <span key={category}>{category}: {count}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card trades-filters-card">
              <div className="assets-filters-grid">
                <label>
                  Suche
                  <input
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Suche nach Name oder Ticker..."
                  />
                </label>
                <label>
                  Kategorie
                  <select value={assetCategoryFilter} onChange={(event) => setAssetCategoryFilter(event.target.value)}>
                    {assetCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
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
                    <th onClick={() => toggleAssetSort("name")} className="sortable">Name{assetSortMarker("name")}</th>
                    <th onClick={() => toggleAssetSort("category")} className="sortable">Kategorie{assetSortMarker("category")}</th>
                    <th>Ticker US</th>
                    <th>Ticker Xetra</th>
                    <th>Währung</th>
                    <th onClick={() => toggleAssetSort("tradesCount")} className="sortable"># Trades{assetSortMarker("tradesCount")}</th>
                    <th onClick={() => toggleAssetSort("realizedPL")} className="sortable">Realisierter P&L{assetSortMarker("realizedPL")}</th>
                    <th onClick={() => toggleAssetSort("openCapital")} className="sortable">Offenes Kapital{assetSortMarker("openCapital")}</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset.name}>
                      <td>{asset.name}</td>
                      <td><span className="asset-badge">{asset.category}</span></td>
                      <td>-</td>
                      <td>-</td>
                      <td>EUR</td>
                      <td>{asset.tradesCount}</td>
                      <td className={asset.realizedPL >= 0 ? "positive" : "negative"}>{money(asset.realizedPL)}</td>
                      <td>{asset.openCapital > 0 ? money(asset.openCapital) : "-"}</td>
                      <td><button className="secondary slim">Bearbeiten</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === "analytics" && analyticsData && (
          <section className="section analytics-page">
            <PageHeader
              title={<><ChartColumn size={18} />Auswertungen</>}
              subtitle="Detaillierte Analyse deiner Trading-Performance"
              actions={<button className="secondary" onClick={() => setView("trades")}><CandlestickChart size={14} />Zu Trades</button>}
            />

            <div className="trades-summary-grid analytics-top-kpis">
              <div className="card">
                <h3><Briefcase size={14} />Analysierte Trades</h3>
                <div className="value">{analyticsData.closedCount}</div>
              </div>
              <div className="card">
                <h3><Percent size={14} />Win-Rate</h3>
                <div className="value positive">{((analyticsData.winners / (analyticsData.closedCount || 1)) * 100).toFixed(1)}%</div>
              </div>
              <div className="card">
                <h3><TrendingUp size={14} />Gesamt P&L</h3>
                <div className={`value ${analyticsData.totalPL >= 0 ? "positive" : "negative"}`}>{money(analyticsData.totalPL)}</div>
              </div>
              <div className="card">
                <h3><ShieldAlert size={14} />Max Drawdown</h3>
                <div className="value negative">{money(analyticsData.maxDrawdown)}</div>
              </div>
              <div className="card">
                <h3><Clock3 size={14} />Handelstage</h3>
                <div className="value">{analyticsData.tradingDays}</div>
              </div>
            </div>

            <div className="card analytics-insights-card">
              <h3><Sparkles size={14} />Konsolidierte Highlights</h3>
              <div className="analytics-insights-list">
                <div className="analytics-insight positive">
                  <span>Stärkste Serie</span>
                  <strong>{analyticsData.bestSeries} Gewinne in Folge</strong>
                </div>
                <div className="analytics-insight negative">
                  <span>Schwächste Serie</span>
                  <strong>{analyticsData.worstSeries} Verluste in Folge</strong>
                </div>
                <div className="analytics-insight">
                  <span>Bester Monat</span>
                  <strong>{analyticsData.bestMonth ? `${money(analyticsData.bestMonth.pl)} (${formatMonthLabel(analyticsData.bestMonth.month)})` : "-"}</strong>
                </div>
                <div className="analytics-insight">
                  <span>Schlechtester Monat</span>
                  <strong>{analyticsData.worstMonth ? `${money(analyticsData.worstMonth.pl)} (${formatMonthLabel(analyticsData.worstMonth.month)})` : "-"}</strong>
                </div>
                <div className="analytics-insight">
                  <span>Top-Basiswert</span>
                  <strong>{analyticsData.topAsset ? `${analyticsData.topAsset[0]} (${money(analyticsData.topAsset[1].pl)})` : "-"}</strong>
                </div>
                <div className="analytics-insight">
                  <span>Flop-Basiswert</span>
                  <strong>{analyticsData.flopAsset ? `${analyticsData.flopAsset[0]} (${money(analyticsData.flopAsset[1].pl)})` : "-"}</strong>
                </div>
              </div>
            </div>

            <div className="analytics-tabbar">
              <button className={analyticsTab === "overview" ? "secondary active" : "secondary"} onClick={() => setAnalyticsTab("overview")}>Überblick</button>
              <button className={analyticsTab === "timing" ? "secondary active" : "secondary"} onClick={() => setAnalyticsTab("timing")}>Timing & Verteilung</button>
              <button className={analyticsTab === "assets" ? "secondary active" : "secondary"} onClick={() => setAnalyticsTab("assets")}>Basiswerte & Typen</button>
            </div>

            {analyticsTab === "overview" && (
              <div className="analytics-tab-panel">
                <div className="card analytics-grid-6">
                  <h3><CircleDollarSign size={14} />Kauf & Verkauf Übersicht</h3>
                  <div className="analytics-mini-grid">
                    <div><span>Σ Kaufvolumen</span><strong>{money(analyticsData.totalBuy)}</strong></div>
                    <div><span>Σ Verkaufsvolumen</span><strong>{money(analyticsData.totalSell)}</strong></div>
                    <div className="accent"><span>Differenz (P&L)</span><strong>{money(analyticsData.totalPL)}</strong></div>
                    <div><span>Ø Positionsgröße</span><strong>{money(analyticsData.avgPosition)}</strong></div>
                    <div><span>Min Position</span><strong>{money(analyticsData.minPosition)}</strong></div>
                    <div><span>Max Position</span><strong>{money(analyticsData.maxPosition)}</strong></div>
                  </div>
                </div>

                <div className="card analytics-grid-8">
                  <h3><LineChart size={14} />Gewinn & Verlust Statistiken</h3>
                  <div className="analytics-mini-grid analytics-eight">
                    <div className="good"><span>Gewinner</span><strong>{analyticsData.winners}</strong></div>
                    <div className="bad"><span>Verlierer</span><strong>{analyticsData.losers}</strong></div>
                    <div className="good"><span>Σ Gewinne</span><strong>{money(analyticsData.grossGain)}</strong></div>
                    <div className="bad"><span>Σ Verluste</span><strong>{money(analyticsData.grossLoss)}</strong></div>
                    <div className="good"><span>Ø Gewinn</span><strong>{money(analyticsData.avgGain)}</strong></div>
                    <div className="bad"><span>Ø Verlust</span><strong>{money(analyticsData.avgLoss)}</strong></div>
                    <div className="good"><span>Profit-Faktor</span><strong>{analyticsData.profitFactor.toFixed(2)}</strong></div>
                    <div><span>Erwartungswert</span><strong>{money(analyticsData.expectancy)}</strong></div>
                  </div>
                </div>

                <div className="card">
                  <h3><ChartColumn size={14} />Gewinn/Verlust Verteilung</h3>
                  <div className="simple-chart">
                    {[
                      { label: "<-500", min: -Infinity, max: -500, color: "loss" },
                      { label: "-500..-200", min: -500, max: -200, color: "loss" },
                      { label: "-200..-100", min: -200, max: -100, color: "loss" },
                      { label: "-100..0", min: -100, max: 0, color: "loss" },
                      { label: "0..100", min: 0, max: 100, color: "win" },
                      { label: "100..200", min: 100, max: 200, color: "win" },
                      { label: "200..500", min: 200, max: 500, color: "win" },
                      { label: ">500", min: 500, max: Infinity, color: "win" }
                    ].map((b) => {
                      const count = analyticsData.closedCount
                        ? trades.filter((t) => {
                            const pl = getTradeRealizedPL(t);
                            return isTradeClosed(t) && pl >= b.min && pl < b.max;
                          }).length
                        : 0;
                      return (
                        <div key={b.label} className="simple-bar-wrap">
                          <div className={`simple-bar ${b.color}`} style={{ height: `${Math.max(6, count * 6)}px` }} />
                          <span>{b.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === "timing" && (
              <div className="analytics-tab-panel">
                <div className="dashboard-bottom-grid">
                  <div className="card">
                    <h3><TrendingUp size={14} />Monats-Performance</h3>
                    <div className="simple-chart">
                      {analyticsData.monthChart.map((m) => (
                        <div key={`m-${m.month}`} className="simple-bar-wrap">
                          <div className={`simple-bar ${m.pl >= 0 ? "win" : "loss"}`} style={{ height: `${Math.max(8, Math.abs(m.pl) / 35)}px` }} />
                          <span>{m.month.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <h3><Target size={14} />Win/Loss Verteilung</h3>
                    <div className="donut-wrap">
                      <div
                        className="donut"
                        style={{
                          background: `conic-gradient(#30c56f 0 ${((analyticsData.winners / analyticsData.closedCount) * 360).toFixed(1)}deg, #ff5d6c 0 360deg)`
                        }}
                      >
                        <div className="donut-inner">{Math.round((analyticsData.winners / analyticsData.closedCount) * 100)}%</div>
                      </div>
                      <p><span className="positive">{analyticsData.winners} Wins</span> / <span className="negative">{analyticsData.losers} Losses</span></p>
                    </div>
                  </div>
                </div>

                <div className="dashboard-bottom-grid">
                  <div className="card">
                    <h3><ChartColumn size={14} />Performance nach Wochentag</h3>
                    <div className="simple-chart">
                      {analyticsData.weekdayData.map((d) => (
                        <div key={`w-${d.label}`} className="simple-bar-wrap">
                          <div className={`simple-bar ${d.value >= 0 ? "win" : "loss"}`} style={{ height: `${Math.max(8, Math.abs(d.value) / 20)}px` }} />
                          <span>{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <h3><Briefcase size={14} />Trades nach Positionsgröße</h3>
                    <div className="simple-chart">
                      {analyticsData.sizeData.map((d) => (
                        <div key={`s-${d.label}`} className="simple-bar-wrap">
                          <div className="simple-bar win" style={{ height: `${Math.max(8, d.value * 7)}px` }} />
                          <span>{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3><Clock3 size={14} />Performance nach Uhrzeit (Kauf)</h3>
                  <div className="simple-chart">
                    {analyticsData.hourData.map((d) => (
                      <div key={`h-${d.label}`} className="simple-bar-wrap">
                        <div className={`simple-bar ${d.value >= 0 ? "win" : "loss"}`} style={{ height: `${Math.max(8, Math.abs(d.value) / 22)}px` }} />
                        <span>{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card analytics-grid-8">
                  <h3><Clock3 size={14} />Haltedauer-Analyse</h3>
                  <div className="analytics-mini-grid analytics-eight">
                    <div><span>Ø Gesamt</span><strong>{analyticsData.hold.avg.toFixed(1)} Tage</strong></div>
                    <div className="good"><span>Ø Wins</span><strong>{analyticsData.hold.winAvg.toFixed(1)} Tage</strong></div>
                    <div className="bad"><span>Ø Losses</span><strong>{analyticsData.hold.lossAvg.toFixed(1)} Tage</strong></div>
                    <div><span>Max Haltedauer</span><strong>{analyticsData.hold.max} Tage</strong></div>
                    <div><span>Intraday</span><strong>{analyticsData.hold.intraday}</strong></div>
                    <div><span>1-7 Tage</span><strong>{analyticsData.hold.oneTo7}</strong></div>
                    <div><span>8-30 Tage</span><strong>{analyticsData.hold.eightTo30}</strong></div>
                    <div><span>30+ Tage</span><strong>{analyticsData.hold.over30}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === "assets" && (
              <div className="analytics-tab-panel">
                <div className="dashboard-bottom-grid">
                  <div className="card">
                    <h3><Database size={14} />Performance pro Basiswert</h3>
                    <table>
                      <thead>
                        <tr><th>Basiswert</th><th>#</th><th>Win%</th><th>P&L</th><th>Rendite</th></tr>
                      </thead>
                      <tbody>
                        {analyticsData.assetRows.map((r) => (
                          <tr key={`ar-${r.name}`}>
                            <td>{r.name}</td>
                            <td>{r.count}</td>
                            <td className={r.winRate >= 50 ? "positive" : "negative"}>{r.winRate.toFixed(1)}%</td>
                            <td className={r.pl >= 0 ? "positive" : "negative"}>{money(r.pl)}</td>
                            <td className={r.rendite >= 0 ? "positive" : "negative"}>{r.rendite.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="card">
                    <h3><CandlestickChart size={14} />Performance pro Trade-Typ</h3>
                    <table>
                      <thead>
                        <tr><th>Typ</th><th>#</th><th>Win%</th><th>P&L</th><th>Rendite</th></tr>
                      </thead>
                      <tbody>
                        {analyticsData.typeRows.map((r) => (
                          <tr key={`tr-${r.type}`}>
                            <td>{r.type}</td>
                            <td>{r.count}</td>
                            <td className={r.winRate >= 50 ? "positive" : "negative"}>{r.winRate.toFixed(1)}%</td>
                            <td className={r.pl >= 0 ? "positive" : "negative"}>{money(r.pl)}</td>
                            <td className={r.rendite >= 0 ? "positive" : "negative"}>{r.rendite.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="dashboard-bottom-grid analytics-risk-row">
              <div className="card">
                <h3><ShieldAlert size={14} />Risiko-Kennzahlen</h3>
                <div className="analytics-mini-grid">
                  <div><span>Standardabweichung</span><strong>{money(analyticsData.stdDev)}</strong></div>
                  <div className="bad"><span>Max. Drawdown</span><strong>{money(analyticsData.maxDrawdown)}</strong></div>
                  <div><span>Gesamtrendite</span><strong className={analyticsData.returnPct >= 0 ? "positive" : "negative"}>{analyticsData.returnPct.toFixed(1)}%</strong></div>
                  <div className="bad"><span>Totalverluste</span><strong>{analyticsData.totalLossTrades}</strong></div>
                  <div><span>Profit-Faktor</span><strong>{analyticsData.profitFactor.toFixed(2)}</strong></div>
                  <div><span>Erwartungswert</span><strong>{money(analyticsData.expectancy)}</strong></div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
