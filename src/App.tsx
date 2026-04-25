import { useEffect, useMemo, useState } from "react";
import type { Trade } from "./types/trade";
import { getKpis, getTradeRealizedPL, isTradeClosed } from "./lib/analytics";
import { saveTradesToStorage } from "./lib/storage";
import { parseTradesCsv } from "./lib/csv";
import { calendarMonthNames } from "./app/constants";
import { daysBetween, getNowLocalDateTimeValue, parseStoredDateTime, toDisplayDateTime, toIsoMonth, toLocalInputValue } from "./app/date";
import { csvEscape, readInitialTrades } from "./app/helpers";
import { buildAnalyticsData, buildAssetRows, buildDashboardMonthlyStats, buildDashboardTopFlop } from "./app/derive";
import { type AssetSortField, type DashboardOpenSortField, defaultForm, type NewTradeForm, type SortDirection, type TradesSortField, type View } from "./app/types";
import { SidebarNav } from "./components/layout/SidebarNav";
import { DashboardView } from "./components/views/DashboardView";
import { TradesView } from "./components/views/TradesView";
import { NewTradeView } from "./components/views/NewTradeView";
import { AssetsView } from "./components/views/AssetsView";
import { AnalyticsView } from "./components/views/AnalyticsView";

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
  const availableTypes = useMemo(() => ["Alle", ...new Set(trades.map((trade) => trade.typ).filter(Boolean))], [trades]);
  const availableBasiswerte = useMemo(() => ["Alle", ...new Set(trades.map((trade) => trade.basiswert).filter(Boolean))], [trades]);

  const baseFilteredTrades = useMemo(() => {
    const searchNormalized = search.trim().toLowerCase();
    return trades.filter((trade) => {
      const matchesSearch = !searchNormalized || trade.name.toLowerCase().includes(searchNormalized) || trade.basiswert.toLowerCase().includes(searchNormalized);
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
      const matchesRange = rangeFilter === "Alle" || (tradeDate !== null && now.getTime() - tradeDate.getTime() <= Number.parseInt(rangeFilter, 10) * 24 * 60 * 60 * 1000);
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
    const winners = filteredTrades.filter((trade) => getTradeRealizedPL(trade) > 0).length;
    const losers = filteredTrades.filter((trade) => getTradeRealizedPL(trade) < 0).length;
    return { totalKauf, totalVerkauf, winners, losers };
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
  const assetCategories = useMemo(() => ["Alle", ...new Set(assetRows.map((row) => row.category))], [assetRows]);
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
    const updated = editingTradeId ? trades.map((trade) => (trade.id === editingTradeId ? next : trade)) : [next, ...trades];
    setTrades(updated);
    saveTradesToStorage(updated);
    setForm(defaultForm());
    setEditingTradeId(null);
    setView("trades");
  };

  const toggleSort = (field: TradesSortField) => {
    if (sortField === field) return setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    setSortField(field);
    setSortDirection(field === "name" || field === "typ" ? "asc" : "desc");
  };
  const sortMarker = (field: TradesSortField) => (sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕");
  const exportTradesCsvForExcel = () => {
    const header = ["tradeId", "name", "typ", "basiswert", "kaufzeitpunkt", "kaufPreis", "stueck", "verkaufszeitpunkt", "verkaufPreis", "gewinn", "status"];
    const rows = trades.map((trade) => [trade.id, trade.name, trade.typ, trade.basiswert, trade.kaufzeitpunkt, trade.kaufPreis, trade.stueck, trade.verkaufszeitpunkt, trade.verkaufPreis, trade.gewinn, trade.status]);
    const csvBody = [header, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(";")).join("\r\n");
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
    if (assetSortField === field) return setAssetSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    setAssetSortField(field);
    setAssetSortDirection(field === "name" || field === "category" ? "asc" : "desc");
  };
  const assetSortMarker = (field: AssetSortField) => (assetSortField === field ? (assetSortDirection === "asc" ? " ↑" : " ↓") : " ↕");
  const toggleDashboardOpenSort = (field: DashboardOpenSortField) => {
    if (dashboardOpenSortField === field) return setDashboardOpenSortDirection((current) => (current === "asc" ? "desc" : "asc"));
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
  const calendarCells = Array.from({ length: calendarStartOffset + daysInCalendarMonth }, (_, idx) => idx - calendarStartOffset + 1);
  const calendarRangeMin = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart < calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeStart;
  const calendarRangeMax = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart > calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeEnd;
  const calendarMonthLabel = `${calendarMonthNames[currentCalendarMonth]} ${currentCalendarYear}`;
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

  return (
    <div className="layout">
      <SidebarNav view={view} onViewChange={setView} />
      <main className="content">
        {view === "dashboard" && (
          <DashboardView
            kpis={kpis}
            dashboardNow={dashboardNow}
            trades={trades}
            dashboardOpenPositions={dashboardOpenPositions}
            dashboardMonthlyStats={dashboardMonthlyStats}
            dashboardTopFlop={dashboardTopFlop}
            onOpenAnalyticsOverview={openAnalyticsOverview}
            onOpenTradesWithOpenFilter={openTradesWithOpenFilter}
            onToggleDashboardOpenSort={toggleDashboardOpenSort}
            dashboardOpenSortMarker={dashboardOpenSortMarker}
            onEditTrade={editTrade}
            onJumpToAsset={jumpToAsset}
          />
        )}
        {view === "trades" && (
          <TradesView
            filteredTrades={filteredTrades}
            trades={trades}
            kpis={kpis}
            tradesSummary={tradesSummary}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typFilter={typFilter}
            onTypFilterChange={setTypFilter}
            basiswertFilter={basiswertFilter}
            onBasiswertFilterChange={setBasiswertFilter}
            rangeFilter={rangeFilter}
            onRangeFilterChange={(value) => {
              setRangeFilter(value);
              setCalendarRangeStart(null);
              setCalendarRangeEnd(null);
            }}
            availableTypes={availableTypes}
            availableBasiswerte={availableBasiswerte}
            sortMarker={sortMarker}
            onToggleSort={toggleSort}
            onImportCsv={importCsv}
            onExportTradesCsvForExcel={exportTradesCsvForExcel}
            onExportTradesJsonBackup={exportTradesJsonBackup}
            onGoToNewTrade={() => setView("newTrade")}
            onEditTrade={editTrade}
            onDeleteTrade={deleteTrade}
            calendarMonthLabel={calendarMonthLabel}
            onCalendarPrevMonth={() => setCalendarMonth(new Date(currentCalendarYear, currentCalendarMonth - 1, 1))}
            onCalendarNextMonth={() => setCalendarMonth(new Date(currentCalendarYear, currentCalendarMonth + 1, 1))}
            onClearCalendarFilter={clearCalendarFilter}
            calendarCells={calendarCells}
            currentCalendarYear={currentCalendarYear}
            currentCalendarMonth={currentCalendarMonth}
            tradesCalendarMap={tradesCalendarMap}
            calendarRangeMin={calendarRangeMin}
            calendarRangeMax={calendarRangeMax}
            calendarRangeStart={calendarRangeStart}
            calendarRangeEnd={calendarRangeEnd}
            onCalendarDayMouseDown={handleCalendarDayMouseDown}
            onCalendarDayMouseEnter={handleCalendarDayMouseEnter}
            onCalendarMouseUp={handleCalendarMouseUp}
            calendarDragMoved={calendarDragMoved}
            setCalendarDragMoved={setCalendarDragMoved}
            onSetSingleDayFilter={setSingleDayFilter}
          />
        )}
        {view === "newTrade" && (
          <NewTradeView
            editingTradeId={editingTradeId}
            form={form}
            setForm={setForm}
            statusClosed={statusClosed}
            gewinn={gewinn}
            rendite={rendite}
            haltedauer={haltedauer}
            monat={monat}
            onSaveNewTrade={saveNewTrade}
            onSetViewTrades={() => setView("trades")}
            onCancelEdit={() => setEditingTradeId(null)}
          />
        )}
        {view === "assets" && (
          <AssetsView
            assetSummary={assetSummary}
            assetSearch={assetSearch}
            onAssetSearchChange={setAssetSearch}
            assetCategoryFilter={assetCategoryFilter}
            onAssetCategoryFilterChange={setAssetCategoryFilter}
            assetCategories={assetCategories}
            filteredAssets={filteredAssets}
            onToggleAssetSort={toggleAssetSort}
            assetSortMarker={assetSortMarker}
            onGoToNewTrade={() => setView("newTrade")}
          />
        )}
        {view === "analytics" && analyticsData && (
          <AnalyticsView
            analyticsData={analyticsData}
            analyticsTab={analyticsTab}
            onAnalyticsTabChange={setAnalyticsTab}
            trades={trades}
            onBackToTrades={() => setView("trades")}
          />
        )}
      </main>
    </div>
  );
}
