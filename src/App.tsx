import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { Trade } from "./types/trade";
import { getKpis, getTradeRealizedPL, isTradeClosed } from "./lib/analytics";
import { saveTradesToStorage } from "./lib/storage";
import { parseAssetsCsv, parseAssetsExcel, parseTradesCsv, parseTradesExcel } from "./lib/csv";
import { loadAssetMetaFromStorage, saveAssetMetaToStorage } from "./lib/assetsStorage";
import { daysBetween, getCalendarMonthLabel, getNowLocalDateTimeValue, getWeekdayNames, parseStoredDateTime, setDateDisplayConfig, toDisplayDateTime, toLocalInputValue } from "./app/date";
import { csvEscape, readInitialTrades } from "./app/helpers";
import { buildAnalyticsData, buildAssetRows, buildDashboardMonthlyStats, buildDashboardTopFlop } from "./app/derive";
import { type AssetMeta, type AssetSortField, type DashboardOpenSortField, defaultForm, type NewTradeForm, type SortDirection, type TradesSortField, type View } from "./app/types";
import { SidebarNav } from "./components/layout/SidebarNav";
import { DashboardView } from "./components/views/DashboardView";
import { TradesView } from "./components/views/TradesView";
import { NewTradeView } from "./components/views/NewTradeView";
import { AssetsView } from "./components/views/AssetsView";
import { AnalyticsView } from "./components/views/AnalyticsView";
import { SettingsView } from "./components/views/SettingsView";
import { defaultAppSettings, getLanguageLocale, readStoredAppSettings, type AppSettings } from "./app/settings";
import { setMoneyFormat } from "./lib/analytics";
import { t } from "./app/i18n";

export default function App() {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readStoredAppSettings());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [view, setView] = useState<View>(() => readStoredAppSettings().defaultStartView);
  const [trades, setTrades] = useState<Trade[]>(() => readInitialTrades());
  const [form, setForm] = useState<NewTradeForm>(() =>
    defaultForm({
      kaufGebuehren: `${readStoredAppSettings().defaultBuyFees ?? defaultAppSettings.defaultBuyFees}`,
      verkaufGebuehren: `${readStoredAppSettings().defaultSellFees ?? defaultAppSettings.defaultSellFees}`
    })
  );
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
  const [assetMeta, setAssetMeta] = useState<AssetMeta[]>(() => loadAssetMetaFromStorage());

  const makeDefaultTradeForm = () =>
    defaultForm({
      kaufGebuehren: `${appSettings.defaultBuyFees ?? 0}`,
      verkaufGebuehren: `${appSettings.defaultSellFees ?? 0}`
    });

  const kpis = useMemo(() => getKpis(trades), [trades]);
  useEffect(() => {
    const timer = window.setInterval(() => setDashboardNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem("app-settings", JSON.stringify(appSettings));
  }, [appSettings]);
  useEffect(() => {
    const locale = appSettings.numberFormat || getLanguageLocale(appSettings.language);
    setMoneyFormat(locale, appSettings.currency);
    setDateDisplayConfig({
      locale: getLanguageLocale(appSettings.language),
      timeZone: appSettings.timezone,
      dateFormat: appSettings.dateFormat
    });
  }, [appSettings]);
  useEffect(() => {
    document.documentElement.setAttribute("data-compact", appSettings.compactMode ? "true" : "false");
  }, [appSettings.compactMode]);

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
  const filteredKpis = useMemo(() => getKpis(filteredTrades), [filteredTrades]);

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
  const assetRowsWithMeta = useMemo(() => {
    const byName = new Map(assetRows.map((row) => [row.name.toLowerCase(), row]));
    const merged = assetRows.map((row) => {
      const meta = assetMeta.find((item) => item.name.toLowerCase() === row.name.toLowerCase());
      return {
        ...row,
        category: meta?.category || row.category,
        tickerUs: meta?.tickerUs,
        tickerXetra: meta?.tickerXetra,
        waehrung: meta?.waehrung
      };
    });
    const additional = assetMeta
      .filter((item) => !byName.has(item.name.toLowerCase()))
      .map((item) => ({
        name: item.name,
        category: item.category || "Manuell",
        tradesCount: 0,
        realizedPL: 0,
        openCapital: 0,
        hasOpen: false,
        tickerUs: item.tickerUs,
        tickerXetra: item.tickerXetra,
        waehrung: item.waehrung
      }));
    return [...merged, ...additional];
  }, [assetRows, assetMeta]);
  const assetCategories = useMemo(() => ["Alle", ...new Set(assetRowsWithMeta.map((row) => row.category))], [assetRowsWithMeta]);
  const filteredAssets = useMemo(() => {
    const normalizedSearch = assetSearch.trim().toLowerCase();
    const base = assetRowsWithMeta.filter((row) => {
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
  }, [assetRowsWithMeta, assetSearch, assetCategoryFilter, assetSortField, assetSortDirection]);

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

  const importTradesFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const rows = isExcel ? await parseTradesExcel(file) : parseTradesCsv(await file.text());
    if (rows.length === 0) {
      window.alert("Keine gültigen Trades gefunden. Bitte Vorlage und Spalten prüfen.");
      return;
    }
    setTrades(rows);
    saveTradesToStorage(rows);
  };

  const templateHeader = [
    "tradeId",
    "name",
    "typ",
    "basiswert",
    "notiz",
    "kaufzeitpunkt",
    "stueck",
    "kaufStueckpreis",
    "kaufTransaktionManuell",
    "kaufGebuehren",
    "kaufPreis",
    "kaufPreisManuell",
    "verkaufszeitpunkt",
    "verkaufStueckpreis",
    "verkaufTransaktionManuell",
    "verkaufSteuern",
    "verkaufGebuehren",
    "verkaufPreisManuell",
    "verkaufPreis",
    "gewinn",
    "status"
  ];
  const templateRows: Array<Array<string | number>> = [
    ["trade-001", "Apple Swing", "Aktie", "AAPL", "Ausbruch über Widerstand mit engem SL.", "2026-04-01 10:00", 10, 150, "", 2.5, 1502.5, "", "2026-04-10 15:45", 168, "", 28, 2.5, "", 1649.5, 147, "Geschlossen"],
    ["trade-002", "BTC Dip Buy", "Long", "BTCUSD", "Nachkauf geplant bei erneutem Rücksetzer.", "2026-04-12 09:30", 0.025, 36000, "", 1, 901, "", "", "", "", "", 1, "", "", "", "Offen"]
  ];

  const downloadImportTemplateCsv = () => {
    const csvBody = [templateHeader, ...templateRows].map((row) => row.map((cell) => csvEscape(cell)).join(";")).join("\r\n");
    const csv = `\uFEFFsep=;\r\n${csvBody}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trades-import-vorlage.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadImportTemplateExcel = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([templateHeader, ...templateRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trades");
    XLSX.writeFile(workbook, "trades-import-vorlage.xlsx");
  };

  const assetTemplateHeader = ["name", "category", "tickerUs", "tickerXetra", "währung"];
  const assetTemplateRows: Array<Array<string>> = [
    ["AAPL", "Aktie", "AAPL", "APC", "USD"],
    ["BTCUSD", "Krypto", "BTC-USD", "", "USD"]
  ];

  const importAssetsFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const rows = isExcel ? await parseAssetsExcel(file) : parseAssetsCsv(await file.text());
    if (rows.length === 0) {
      window.alert("Keine gültigen Basiswerte gefunden. Bitte Vorlage und Spalten prüfen.");
      return;
    }
    setAssetMeta(rows);
    saveAssetMetaToStorage(rows);
  };

  const downloadAssetTemplateCsv = () => {
    const csvBody = [assetTemplateHeader, ...assetTemplateRows].map((row) => row.map((cell) => csvEscape(cell)).join(";")).join("\r\n");
    const csv = `\uFEFFsep=;\r\n${csvBody}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "basiswerte-import-vorlage.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadAssetTemplateExcel = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([assetTemplateHeader, ...assetTemplateRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Basiswerte");
    XLSX.writeFile(workbook, "basiswerte-import-vorlage.xlsx");
  };

  const exportAssetsCsv = () => {
    const header = ["name", "category", "tickerUs", "tickerXetra", "währung", "tradesCount", "realizedPL", "openCapital"];
    const rows = assetRowsWithMeta.map((asset) => [
      asset.name,
      asset.category,
      asset.tickerUs ?? "",
      asset.tickerXetra ?? "",
      asset.waehrung ?? "EUR",
      asset.tradesCount,
      asset.realizedPL,
      asset.openCapital
    ]);
    const csvBody = [header, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(";")).join("\r\n");
    const csv = `\uFEFFsep=;\r\n${csvBody}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "basiswerte-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAssetsExcel = () => {
    const header = ["name", "category", "tickerUs", "tickerXetra", "währung", "tradesCount", "realizedPL", "openCapital"];
    const rows = assetRowsWithMeta.map((asset) => [
      asset.name,
      asset.category,
      asset.tickerUs ?? "",
      asset.tickerXetra ?? "",
      asset.waehrung ?? "EUR",
      asset.tradesCount,
      asset.realizedPL,
      asset.openCapital
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Basiswerte");
    XLSX.writeFile(workbook, "basiswerte-export.xlsx");
  };

  const stueck = Number.parseFloat(form.stueck) || 0;
  const kaufStueckpreis = Number.parseFloat(form.kaufStueckpreis) || 0;
  const kaufTransaktionManuell = Number.parseFloat(form.kaufTransaktionManuell);
  const kaufGebuehren = Number.parseFloat(form.kaufGebuehren) || 0;
  const kaufPreisAutomatisch = stueck > 0 ? stueck * kaufStueckpreis + kaufGebuehren : 0;
  const kaufPreisManuell = Number.parseFloat(form.kaufPreisManuell);
  const verkaufStueckpreis = Number.parseFloat(form.verkaufStueckpreis) || 0;
  const verkaufTransaktionManuell = Number.parseFloat(form.verkaufTransaktionManuell);
  const verkaufGebuehren = Number.parseFloat(form.verkaufGebuehren) || 0;
  const verkaufPreisManuell = Number.parseFloat(form.verkaufPreisManuell);
  const kaufTransaktion =
    form.kaufTransaktionManuell.trim() !== "" && Number.isFinite(kaufTransaktionManuell) ? kaufTransaktionManuell : stueck > 0 ? stueck * kaufStueckpreis : 0;
  const verkaufTransaktion =
    form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell) ? verkaufTransaktionManuell : stueck > 0 ? stueck * verkaufStueckpreis : 0;
  const verkaufSteuern = form.verkaufSteuern.trim() === "" ? verkaufTransaktion * 0.275 : Number.parseFloat(form.verkaufSteuern) || 0;
  const kaufPreis = form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuell) ? kaufPreisManuell : kaufTransaktion + kaufGebuehren;
  const verkaufPreisAutomatisch = stueck > 0 ? verkaufTransaktion - verkaufSteuern - verkaufGebuehren : 0;
  const verkaufPreis = form.verkaufPreisManuell.trim() !== "" && Number.isFinite(verkaufPreisManuell) ? verkaufPreisManuell : verkaufPreisAutomatisch;
  const statusClosed = !!form.verkaufszeitpunkt;
  const gewinn = statusClosed ? verkaufPreis - kaufPreis : 0;
  const rendite = kaufPreis > 0 ? (gewinn / kaufPreis) * 100 : 0;
  const haltedauer = statusClosed ? daysBetween(form.kaufzeitpunkt, form.verkaufszeitpunkt) : 0;

  const saveNewTrade = () => {
    if (!form.name.trim() || !form.basiswert.trim() || !form.kaufzeitpunkt || stueck <= 0 || kaufStueckpreis <= 0 || kaufPreis <= 0) return;
    const next: Trade = {
      id: editingTradeId ?? `trade-${Date.now()}`,
      name: form.name.trim(),
      typ: form.typ,
      basiswert: form.basiswert.trim(),
      notiz: form.notiz.trim() || undefined,
      kaufzeitpunkt: toDisplayDateTime(form.kaufzeitpunkt),
      kaufPreis,
      stueck: stueck > 0 ? stueck : undefined,
      kaufStueckpreis: kaufStueckpreis > 0 ? kaufStueckpreis : undefined,
      kaufTransaktionManuell: form.kaufTransaktionManuell.trim() !== "" && Number.isFinite(kaufTransaktionManuell) ? kaufTransaktionManuell : undefined,
      kaufGebuehren: kaufGebuehren,
      kaufPreisManuell: form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuell) ? kaufPreisManuell : undefined,
      verkaufszeitpunkt: statusClosed ? toDisplayDateTime(form.verkaufszeitpunkt) : undefined,
      verkaufPreis: statusClosed ? verkaufPreis : undefined,
      verkaufStueckpreis: statusClosed && verkaufStueckpreis > 0 ? verkaufStueckpreis : undefined,
      verkaufTransaktionManuell: statusClosed && form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell) ? verkaufTransaktionManuell : undefined,
      verkaufSteuern: statusClosed ? verkaufSteuern : undefined,
      verkaufGebuehren: statusClosed ? verkaufGebuehren : undefined,
      verkaufPreisManuell: statusClosed && form.verkaufPreisManuell.trim() !== "" && Number.isFinite(verkaufPreisManuell) ? verkaufPreisManuell : undefined,
      gewinn: statusClosed ? gewinn : undefined,
      status: statusClosed ? "Geschlossen" : "Offen"
    };
    const updated = editingTradeId ? trades.map((trade) => (trade.id === editingTradeId ? next : trade)) : [next, ...trades];
    setTrades(updated);
    saveTradesToStorage(updated);
    setForm(makeDefaultTradeForm());
    setEditingTradeId(null);
    setView("trades");
  };

  const startNewTrade = () => {
    setEditingTradeId(null);
    setForm(makeDefaultTradeForm());
    setView("newTrade");
  };

  const toggleSort = (field: TradesSortField) => {
    if (sortField === field) return setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    setSortField(field);
    setSortDirection(field === "name" || field === "typ" ? "asc" : "desc");
  };
  const sortMarker = (field: TradesSortField) => (sortField === field ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕");
  const exportTradesCsvForExcel = () => {
    const header = [
      "tradeId",
      "name",
      "typ",
      "basiswert",
      "notiz",
      "kaufzeitpunkt",
      "stueck",
      "kaufStueckpreis",
      "kaufTransaktionManuell",
      "kaufGebuehren",
      "kaufPreis",
      "kaufPreisManuell",
      "verkaufszeitpunkt",
      "verkaufStueckpreis",
      "verkaufTransaktionManuell",
      "verkaufSteuern",
      "verkaufGebuehren",
      "verkaufPreisManuell",
      "verkaufPreis",
      "gewinn",
      "status"
    ];
    const rows = trades.map((trade) => [
      trade.id,
      trade.name,
      trade.typ,
      trade.basiswert,
      trade.notiz,
      trade.kaufzeitpunkt,
      trade.stueck,
      trade.kaufStueckpreis,
      trade.kaufTransaktionManuell,
      trade.kaufGebuehren,
      trade.kaufPreis,
      trade.kaufPreisManuell,
      trade.verkaufszeitpunkt,
      trade.verkaufStueckpreis,
      trade.verkaufTransaktionManuell,
      trade.verkaufSteuern,
      trade.verkaufGebuehren,
      trade.verkaufPreisManuell,
      trade.verkaufPreis,
      trade.gewinn,
      trade.status
    ]);
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
    if (appSettings.confirmBeforeDelete) {
      const confirmed = window.confirm(appSettings.language === "en" ? "Delete this trade?" : "Diesen Trade wirklich löschen?");
      if (!confirmed) return;
    }
    const updated = trades.filter((trade) => trade.id !== id);
    setTrades(updated);
    saveTradesToStorage(updated);
    if (editingTradeId === id) {
      setEditingTradeId(null);
      setForm(makeDefaultTradeForm());
    }
  };
  const editTrade = (trade: Trade) => {
    const qty = trade.stueck && trade.stueck > 0 ? trade.stueck : 1;
    setEditingTradeId(trade.id);
    setForm({
      name: trade.name,
      typ: trade.typ,
      basiswert: trade.basiswert,
      notiz: trade.notiz ?? "",
      kaufzeitpunkt: toLocalInputValue(trade.kaufzeitpunkt),
      stueck: `${qty}`,
      kaufStueckpreis: trade.kaufStueckpreis !== undefined ? `${trade.kaufStueckpreis}` : `${(trade.kaufPreis ?? 0) / qty}`,
      kaufTransaktionManuell: trade.kaufTransaktionManuell !== undefined ? `${trade.kaufTransaktionManuell}` : "",
      kaufGebuehren: `${trade.kaufGebuehren ?? appSettings.defaultBuyFees ?? 0}`,
      kaufPreisManuell: trade.kaufPreisManuell !== undefined ? `${trade.kaufPreisManuell}` : "",
      verkaufszeitpunkt: toLocalInputValue(trade.verkaufszeitpunkt),
      verkaufStueckpreis: trade.verkaufStueckpreis !== undefined ? `${trade.verkaufStueckpreis}` : trade.verkaufPreis !== undefined ? `${trade.verkaufPreis / qty}` : "",
      verkaufTransaktionManuell: trade.verkaufTransaktionManuell !== undefined ? `${trade.verkaufTransaktionManuell}` : "",
      verkaufSteuern: `${trade.verkaufSteuern ?? ""}`,
      verkaufGebuehren: `${trade.verkaufGebuehren ?? appSettings.defaultSellFees ?? 0}`,
      verkaufPreisManuell: trade.verkaufPreisManuell !== undefined ? `${trade.verkaufPreisManuell}` : ""
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
  const weekStartsOnMonday = appSettings.weekStartsOn === "monday";
  const calendarStartOffset = weekStartsOnMonday ? (firstDayOfCalendarMonth.getDay() + 6) % 7 : firstDayOfCalendarMonth.getDay();
  const calendarCells = Array.from({ length: calendarStartOffset + daysInCalendarMonth }, (_, idx) => idx - calendarStartOffset + 1);
  const calendarRangeMin = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart < calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeStart;
  const calendarRangeMax = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart > calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeEnd;
  const calendarMonthLabel = getCalendarMonthLabel(calendarMonth);
  const calendarWeekdayNames = getWeekdayNames(appSettings.weekStartsOn, appSettings.language);
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
      <SidebarNav view={view} onViewChange={setView} theme={theme} onThemeChange={setTheme} language={appSettings.language} />
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
            exchange={appSettings.exchange}
            language={appSettings.language}
            showMarketPulse={appSettings.showMarketPulse}
          />
        )}
        {view === "trades" && (
          <TradesView
            filteredTrades={filteredTrades}
            trades={trades}
            kpis={filteredKpis}
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
            onImportTradesFile={importTradesFile}
            onDownloadImportTemplateCsv={downloadImportTemplateCsv}
            onDownloadImportTemplateExcel={downloadImportTemplateExcel}
            onExportTradesCsvForExcel={exportTradesCsvForExcel}
            onExportTradesJsonBackup={exportTradesJsonBackup}
            onGoToNewTrade={startNewTrade}
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
            calendarWeekdayNames={calendarWeekdayNames}
            language={appSettings.language}
          />
        )}
        {view === "newTrade" && (
          <NewTradeView
            editingTradeId={editingTradeId}
            trades={trades}
            form={form}
            setForm={setForm}
            statusClosed={statusClosed}
            gewinn={gewinn}
            rendite={rendite}
            haltedauer={haltedauer}
            onSaveNewTrade={saveNewTrade}
            onSetViewTrades={() => setView("trades")}
            onResetForm={() => setForm(makeDefaultTradeForm())}
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
            onImportAssetsFile={importAssetsFile}
            onDownloadAssetTemplateCsv={downloadAssetTemplateCsv}
            onDownloadAssetTemplateExcel={downloadAssetTemplateExcel}
            onExportAssetsCsv={exportAssetsCsv}
            onExportAssetsExcel={exportAssetsExcel}
            onGoToNewTrade={startNewTrade}
            financeService={appSettings.financeService}
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
        {view === "settings" && (
          <SettingsView settings={appSettings ?? defaultAppSettings} onSettingsChange={setAppSettings} onApplyTheme={setTheme} currentTheme={theme} t={(key) => t(appSettings.language, key)} />
        )}
      </main>
    </div>
  );
}
