import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Trade } from "./types/trade";
import { getKpis, getTradeRealizedPL, isTradeClosed } from "./lib/analytics";
import { saveTradesToStorage } from "./lib/storage";
import { buildAppBackupJson, parseTradesBackupImport } from "./lib/backup";
import { parseAssetsCsv, parseAssetsExcel, parseTradesCsv, parseTradesExcel } from "./lib/csv";
import {
  applyBasiswertMergeToTrades,
  canonicalizeBasiswert,
  countAssetMetaDuplicateGroups,
  countTradeBasiswertRenames,
  normalizeAndMergeAssetMetaList,
  sameBasiswertBucket
} from "./lib/basiswertCanonical";
import { loadAssetMetaFromStorage, saveAssetMetaToStorage } from "./lib/assetsStorage";
import { countKnownTickerKeys, enrichAssetMetaFromKnownTickers } from "./lib/enrichAssetMetaFromKnownTickers";
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
import { JournalView } from "./components/views/JournalView";
import { AiAssistantPlanView } from "./components/views/AiAssistantPlanView";
import { AiAssistantView } from "./components/views/AiAssistantView";
import { IsinLiveView } from "./components/views/IsinLiveView";
import { defaultAppSettings, getLanguageLocale, readStoredAppSettings, type AppSettings } from "./app/settings";
import { setMoneyFormat } from "./lib/analytics";
import { t } from "./app/i18n";
import { normalizeBasiswertKey } from "./data/knownAssetTickers";
import { loadAiKnowledgeFromStorage, saveAiKnowledgeToStorage } from "./lib/aiKnowledgeStorage";
import { loadJournalFromStorage, saveJournalToStorage, type JournalData } from "./lib/journalStorage";
import { toIsoWeekKey, toLocalYmd } from "./lib/journalIsoWeek";
import { buildReconcileRows } from "./lib/isinWknReconcile";
import { loadCloudSnapshot, saveCloudSnapshot, type CloudSnapshot } from "./lib/cloudStorage";
import { supabase, supabaseConfigured } from "./lib/supabaseClient";

function mergeAiMarkdownIntoJournal(existing: string, heading: string, block: string): string {
  const c = existing.trimEnd();
  const b = block.trim();
  if (!b) return c;
  return c ? `${c}\n\n---\n\n${heading}\n\n${b}` : `${heading}\n\n${b}`;
}

function normalizeTradesOnLoad(trades: Trade[]): { trades: Trade[]; changed: boolean } {
  let changed = false;
  const noBasiswertTypes = new Set<string>(["Steuerkorrektur", "Zinszahlung"]);

  const next = trades.map((trade) => {
    let t = trade;

    // Globale Steuer-Cashflow-Konvention:
    // - Steuerzahlung = negativ
    // - Steuererstattung/Korrektur = positiv
    // Für Bestandsdaten: bisherige positive Steuerwerte bei normalen Trades auf negativ drehen.
    const hasTaxes = t.verkaufSteuern !== undefined && Number.isFinite(t.verkaufSteuern);
    if (hasTaxes && t.typ !== "Steuerkorrektur" && (t.verkaufSteuern as number) > 0) {
      t = { ...t, verkaufSteuern: -Math.abs(t.verkaufSteuern as number) };
      changed = true;
    }

    if (noBasiswertTypes.has(t.typ) && (t.basiswert ?? "").trim() !== "") {
      t = { ...t, basiswert: "" };
      changed = true;
    }

    if (t.typ !== "Steuerkorrektur") return t;

    // 1) Steuerkorrektur hat nur EINEN Buchungszeitpunkt (kaufzeitpunkt).
    const sellTime = t.verkaufszeitpunkt?.trim();
    const buyTime = t.kaufzeitpunkt?.trim();
    if (sellTime && !buyTime) {
      t = { ...t, kaufzeitpunkt: sellTime, verkaufszeitpunkt: undefined };
      changed = true;
    } else if (buyTime && sellTime) {
      t = { ...t, verkaufszeitpunkt: undefined };
      changed = true;
    }

    // 2) Migration: Steuerkorrektur-Betrag aus "Verkauf/Erlös" ins Feld "Steuern" verschieben.
    // Ziel: Steuerkorrekturen sollen nicht als Erlös/P&L wirken, sondern ausschließlich als Steuerbetrag.
    const hasTaxesCorrection = t.verkaufSteuern !== undefined && Number.isFinite(t.verkaufSteuern);
    const sellAmount = t.verkaufPreis !== undefined && Number.isFinite(t.verkaufPreis) ? t.verkaufPreis : undefined;
    if (!hasTaxesCorrection && sellAmount !== undefined && sellAmount !== 0) {
      t = {
        ...t,
        // Legacy-Migration: Steuerkorrektur-Betrag aus "Erlös" ins Steuerfeld verschieben.
        // In der neuen Konvention gilt: + = Erstattung, - = Nachzahlung.
        verkaufSteuern: sellAmount,
        // Erlös/Verkauf auf 0 setzen, damit P&L nicht “verzerrt” wird.
        verkaufPreis: 0,
        verkaufPreisManuell: undefined,
        verkaufTransaktionManuell: undefined,
        verkaufStueckpreis: undefined,
        stueck: undefined,
        verkaufszeitpunkt: undefined
      };
      changed = true;
    }

    return t;
  });

  return { trades: next, changed };
}

export default function App() {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readStoredAppSettings());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [view, setView] = useState<View>(() => readStoredAppSettings().defaultStartView as View);
  const [trades, setTrades] = useState<Trade[]>(() => normalizeTradesOnLoad(readInitialTrades()).trades);
  const [form, setForm] = useState<NewTradeForm>(() =>
    defaultForm({
      kaufGebuehren: `${readStoredAppSettings().defaultBuyFees ?? defaultAppSettings.defaultBuyFees}`,
      verkaufGebuehren: `${readStoredAppSettings().defaultSellFees ?? defaultAppSettings.defaultSellFees}`
    })
  );
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  /** Stabile Trade-ID für Autospeichern bei neuem Trade (ohne Bearbeitungsmodus). */
  const newTradeDraftIdRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Alle" | Trade["status"]>("Alle");
  const [typFilter, setTypFilter] = useState<string[]>([]);
  const [basiswertFilter, setBasiswertFilter] = useState<string[]>([]);
  const [rangeFilter, setRangeFilter] = useState<"Alle" | "heute" | "7" | "30" | "monat" | "jahr" | "365">("Alle");
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [journalData, setJournalData] = useState<JournalData>(() => loadJournalFromStorage());
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState(() => loadAiKnowledgeFromStorage());
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudHydrating, setCloudHydrating] = useState(false);

  const handleViewChange = (nextView: View) => {
    setView(nextView);
    setMobileMenuOpen(false);
  };

  const handleJournalDayChange = (ymd: string, text: string) => {
    setJournalData((prev) => {
      const byDay = { ...prev.byDay };
      const trimmed = text.trim();
      if (trimmed) byDay[ymd] = text;
      else delete byDay[ymd];
      const next = { ...prev, byDay };
      saveJournalToStorage(next);
      return next;
    });
  };

  const handleJournalWeekChange = (weekKey: string, text: string) => {
    setJournalData((prev) => {
      const byWeek = { ...prev.byWeek };
      const trimmed = text.trim();
      if (trimmed) byWeek[weekKey] = text;
      else delete byWeek[weekKey];
      const next = { ...prev, byWeek };
      saveJournalToStorage(next);
      return next;
    });
  };

  const handleJournalMonthChange = (ym: string, text: string) => {
    setJournalData((prev) => {
      const byMonth = { ...prev.byMonth };
      const trimmed = text.trim();
      if (trimmed) byMonth[ym] = text;
      else delete byMonth[ym];
      const next = { ...prev, byMonth };
      saveJournalToStorage(next);
      return next;
    });
  };

  const handleAiKnowledgeBaseChange = (text: string) => {
    setAiKnowledgeBase(text);
    saveAiKnowledgeToStorage(text);
  };

  const handleAppendAiToJournal = (target: "day" | "week" | "month", markdown: string) => {
    const block = markdown.trim();
    if (!block) return;
    const now = new Date();
    const locale = getLanguageLocale(appSettings.language);
    const stand = now.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
    const heading = t(appSettings.language, "journalAiPasteBlockTitle", { stand });

    setJournalData((prev) => {
      if (target === "day") {
        const ymd = toLocalYmd(now);
        const byDay = { ...prev.byDay };
        byDay[ymd] = mergeAiMarkdownIntoJournal(byDay[ymd] ?? "", heading, block);
        const next = { ...prev, byDay };
        saveJournalToStorage(next);
        return next;
      }
      if (target === "week") {
        const weekKey = toIsoWeekKey(now);
        const byWeek = { ...prev.byWeek };
        byWeek[weekKey] = mergeAiMarkdownIntoJournal(byWeek[weekKey] ?? "", heading, block);
        const next = { ...prev, byWeek };
        saveJournalToStorage(next);
        return next;
      }
      const ym = toLocalYmd(now).slice(0, 7);
      const byMonth = { ...prev.byMonth };
      byMonth[ym] = mergeAiMarkdownIntoJournal(byMonth[ym] ?? "", heading, block);
      const next = { ...prev, byMonth };
      saveJournalToStorage(next);
      return next;
    });
  };

  const makeDefaultTradeForm = () =>
    defaultForm({
      kaufGebuehren: `${appSettings.defaultBuyFees ?? 0}`,
      verkaufGebuehren: `${appSettings.defaultSellFees ?? 0}`
    });
  const buildSnapshot = (): CloudSnapshot => ({
    trades,
    assetMeta,
    journalData,
    aiKnowledgeBase,
    appSettings,
    theme
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
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    // Stelle sicher, dass eventuelle Migrationen auch in localStorage persistiert werden.
    const normalized = normalizeTradesOnLoad(trades);
    if (!normalized.changed) return;
    setTrades(normalized.trades);
    saveTradesToStorage(normalized.trades);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!userId) {
      setCloudReady(false);
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      setCloudHydrating(true);
      try {
        const remote = await loadCloudSnapshot(userId);
        if (cancelled) return;
        if (remote) {
          const normalizedTrades = normalizeTradesOnLoad(Array.isArray(remote.trades) ? remote.trades : []).trades;
          setTrades(normalizedTrades);
          saveTradesToStorage(normalizedTrades);
          setAssetMeta(Array.isArray(remote.assetMeta) ? remote.assetMeta : []);
          saveAssetMetaToStorage(Array.isArray(remote.assetMeta) ? remote.assetMeta : []);
          setJournalData(remote.journalData ?? { byDay: {}, byWeek: {}, byMonth: {} });
          saveJournalToStorage(remote.journalData ?? { byDay: {}, byWeek: {}, byMonth: {} });
          setAiKnowledgeBase(remote.aiKnowledgeBase ?? "");
          saveAiKnowledgeToStorage(remote.aiKnowledgeBase ?? "");
          if (remote.appSettings) setAppSettings({ ...defaultAppSettings, ...remote.appSettings });
          if (remote.theme === "dark" || remote.theme === "light") setTheme(remote.theme);
        } else {
          await saveCloudSnapshot(userId, buildSnapshot());
        }
        setCloudReady(true);
      } catch (error) {
        console.error("Cloud sync init failed:", error);
      } finally {
        if (!cancelled) setCloudHydrating(false);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId]);
  useEffect(() => {
    if (!userId || !cloudReady || cloudHydrating) return;
    const id = window.setTimeout(() => {
      void saveCloudSnapshot(userId, buildSnapshot()).catch((error) => {
        console.error("Cloud save failed:", error);
      });
    }, 800);
    return () => window.clearTimeout(id);
  }, [userId, cloudReady, cloudHydrating, trades, assetMeta, journalData, aiKnowledgeBase, appSettings, theme]);

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
  const availableTypes = useMemo(() => [...new Set(trades.map((trade) => trade.typ).filter(Boolean))], [trades]);
  const availableBasiswerte = useMemo(() => [...new Set(trades.map((trade) => trade.basiswert).filter(Boolean))], [trades]);

  const baseFilteredTrades = useMemo(() => {
    const searchNormalized = search.trim().toLowerCase();
    return trades.filter((trade) => {
      const matchesSearch = !searchNormalized || trade.name.toLowerCase().includes(searchNormalized) || trade.basiswert.toLowerCase().includes(searchNormalized);
      const matchesStatus = statusFilter === "Alle" || trade.status === statusFilter;
      const matchesTyp = typFilter.length === 0 || typFilter.includes(trade.typ);
      const matchesBasiswert = basiswertFilter.length === 0 || basiswertFilter.includes(trade.basiswert);
      return matchesSearch && matchesStatus && matchesTyp && matchesBasiswert;
    });
  }, [trades, search, statusFilter, typFilter, basiswertFilter]);

  const getTradeDateKeys = (trade: Trade): string[] => {
    const keys = new Set<string>();
    const kaufDate = parseStoredDateTime(trade.kaufzeitpunkt);
    if (kaufDate) {
      keys.add(`${kaufDate.getFullYear()}-${`${kaufDate.getMonth() + 1}`.padStart(2, "0")}-${`${kaufDate.getDate()}`.padStart(2, "0")}`);
    }
    const verkaufDate = parseStoredDateTime(trade.verkaufszeitpunkt);
    if (verkaufDate) {
      keys.add(`${verkaufDate.getFullYear()}-${`${verkaufDate.getMonth() + 1}`.padStart(2, "0")}-${`${verkaufDate.getDate()}`.padStart(2, "0")}`);
    }
    return [...keys];
  };

  const getTradeDateTimes = (trade: Trade): Date[] => {
    const dates: Date[] = [];
    const kaufDate = parseStoredDateTime(trade.kaufzeitpunkt);
    if (kaufDate) dates.push(kaufDate);
    const verkaufDate = parseStoredDateTime(trade.verkaufszeitpunkt);
    if (verkaufDate) dates.push(verkaufDate);
    return dates;
  };

  const filteredTrades = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dateRangeStart = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart < calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeStart;
    const dateRangeEnd = calendarRangeStart && calendarRangeEnd ? (calendarRangeStart > calendarRangeEnd ? calendarRangeStart : calendarRangeEnd) : calendarRangeEnd;
    const base = baseFilteredTrades.filter((trade) => {
      const tradeDateTimes = getTradeDateTimes(trade);
      const tradeDateKeys = getTradeDateKeys(trade);
      const matchesRange =
        rangeFilter === "Alle" ||
        (rangeFilter === "heute" && tradeDateTimes.some((tradeDate) => tradeDate >= startOfToday)) ||
        (rangeFilter === "monat" && tradeDateTimes.some((tradeDate) => tradeDate >= startOfMonth)) ||
        (rangeFilter === "jahr" && tradeDateTimes.some((tradeDate) => tradeDate >= startOfYear)) ||
        (rangeFilter === "7" && tradeDateTimes.some((tradeDate) => now.getTime() - tradeDate.getTime() <= 7 * 24 * 60 * 60 * 1000)) ||
        (rangeFilter === "30" && tradeDateTimes.some((tradeDate) => now.getTime() - tradeDate.getTime() <= 30 * 24 * 60 * 60 * 1000)) ||
        (rangeFilter === "365" && tradeDateTimes.some((tradeDate) => now.getTime() - tradeDate.getTime() <= 365 * 24 * 60 * 60 * 1000));
      if (!matchesRange) return false;
      if (!dateRangeStart || !dateRangeEnd) return true;
      if (tradeDateKeys.length === 0) return false;
      return tradeDateKeys.some((key) => key >= dateRangeStart && key <= dateRangeEnd);
    });

    return [...base].sort((a, b) => {
      if (sortField === "rendite") {
        const pct = (t: Trade) =>
          isTradeClosed(t) && t.kaufPreis > 0 ? (getTradeRealizedPL(t) / t.kaufPreis) * 100 : null;
        const pa = pct(a);
        const pb = pct(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        if (pa < pb) return sortDirection === "asc" ? -1 : 1;
        if (pa > pb) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }
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
      getTradeDateKeys(trade).forEach((key) => {
        const [yearRaw, monthRaw] = key.split("-");
        const year = Number(yearRaw);
        const monthIndex = Number(monthRaw) - 1;
        if (year !== calendarMonth.getFullYear() || monthIndex !== calendarMonth.getMonth()) return;
        const bucket = map.get(key) ?? [];
        bucket.push(trade);
        map.set(key, bucket);
      });
    });
    return map;
  }, [baseFilteredTrades, calendarMonth]);

  const assetRows = useMemo(() => buildAssetRows(trades), [trades]);
  const basiswertMergePreview = useMemo(
    () => ({
      tradeRenames: countTradeBasiswertRenames(trades),
      metaCollapses: countAssetMetaDuplicateGroups(assetMeta)
    }),
    [trades, assetMeta]
  );
  const reconcileRows = useMemo(() => buildReconcileRows(trades, assetMeta), [trades, assetMeta]);

  const assetRowsWithMeta = useMemo(() => {
    const byName = new Map(assetRows.map((row) => [row.name.toLowerCase(), row]));
    const merged = assetRows.map((row) => {
      const meta = assetMeta.find((item) => item.name.toLowerCase() === row.name.toLowerCase());
      return {
        ...row,
        category: meta?.category || row.category,
        ticker: meta?.ticker,
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
        ticker: item.ticker,
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
    const lang = appSettings.language;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".json")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        window.alert(t(lang, "importJsonInvalid"));
        return;
      }
      const backup = parseTradesBackupImport(parsed);
      if (!backup) {
        window.alert(t(lang, "importJsonInvalid"));
        return;
      }
      const merged = applyBasiswertMergeToTrades(backup.trades).next;
      setTrades(merged);
      saveTradesToStorage(merged);
      if (backup.replaceAssetMeta && backup.assetMeta !== undefined) {
        const metaMerged = normalizeAndMergeAssetMetaList(backup.assetMeta).next;
        setAssetMeta(metaMerged);
        saveAssetMetaToStorage(metaMerged);
      } else if (backup.assetMeta && backup.assetMeta.length > 0) {
        const metaMerged = normalizeAndMergeAssetMetaList(backup.assetMeta).next;
        setAssetMeta(metaMerged);
        saveAssetMetaToStorage(metaMerged);
      }
      if (backup.appSettings) {
        setAppSettings({ ...defaultAppSettings, ...backup.appSettings });
      }
      if (backup.theme === "dark" || backup.theme === "light") {
        setTheme(backup.theme);
      }
      if (backup.journal) {
        saveJournalToStorage(backup.journal);
        setJournalData(backup.journal);
      }
      if (backup.aiKnowledgeBase !== undefined) {
        setAiKnowledgeBase(backup.aiKnowledgeBase);
        saveAiKnowledgeToStorage(backup.aiKnowledgeBase);
      }
      const moreParts: string[] = [];
      if (backup.appSettings) moreParts.push(t(lang, "importJsonPartSettings"));
      if (backup.theme) moreParts.push(t(lang, "importJsonPartTheme"));
      if (backup.journal) moreParts.push(t(lang, "importJsonPartJournal"));
      if (backup.aiKnowledgeBase !== undefined) moreParts.push(t(lang, "importJsonPartAiKb"));
      const more =
        moreParts.length > 0
          ? t(lang, "importJsonOkMore", { list: moreParts.join(", ") })
          : "";
      window.alert(
        t(lang, "importJsonOk", {
          trades: merged.length,
          assets: backup.assetMeta?.length ? t(lang, "importJsonOkAssets") : "",
          more
        })
      );
      return;
    }
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const rows = isExcel ? await parseTradesExcel(file) : parseTradesCsv(await file.text());
    if (rows.length === 0) {
      window.alert(t(lang, "importNoTrades"));
      return;
    }
    const merged = applyBasiswertMergeToTrades(rows).next;
    setTrades(merged);
    saveTradesToStorage(merged);
  };

  const templateHeader = [
    "tradeId",
    "name",
    "typ",
    "basiswert",
    "isin",
    "wkn",
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
    ["trade-001", "Apple Swing", "Aktie", "AAPL", "US0378331005", "865985", "Ausbruch über Widerstand mit engem SL.", "2026-04-01 10:00", 10, 150, "", 2.5, 1502.5, "", "2026-04-10 15:45", 168, "", 28, 2.5, "", 1649.5, 147, "Geschlossen"],
    ["trade-002", "BTC Dip Buy", "Long", "BTCUSD", "", "", "Nachkauf geplant bei erneutem Rücksetzer.", "2026-04-12 09:30", 0.025, 36000, "", 1, 901, "", "", "", "", "", 1, "", "", "", "Offen"]
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

  const assetTemplateHeader = ["name", "category", "ticker", "währung"];
  const assetTemplateRows: Array<Array<string>> = [
    ["AAPL", "Aktie", "NASDAQ:AAPL", "USD"],
    ["BTCUSD", "Krypto", "BINANCE:BTCUSDT", "USD"]
  ];

  const importAssetsFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const rows = isExcel ? await parseAssetsExcel(file) : parseAssetsCsv(await file.text());
    if (rows.length === 0) {
      window.alert(t(appSettings.language, "importNoAssets"));
      return;
    }
    const merged = normalizeAndMergeAssetMetaList(rows).next;
    setAssetMeta(merged);
    saveAssetMetaToStorage(merged);
  };

  const saveAssetMetaPatch = (patch: AssetMeta, renameFrom?: string) => {
    const canon = canonicalizeBasiswert(patch.name.trim());
    if (!canon) {
      window.alert(t(appSettings.language, "basiswertEmpty"));
      return;
    }
    const patchNorm: AssetMeta = { ...patch, name: canon };
    const renameTrim = renameFrom?.trim() ?? "";
    const doingRename = Boolean(renameTrim && !sameBasiswertBucket(renameTrim, canon));

    if (doingRename) {
      setTrades((prev) => {
        const next = prev.map((t) =>
          sameBasiswertBucket(t.basiswert, renameTrim) ? { ...t, basiswert: canon } : t
        );
        saveTradesToStorage(next);
        return next;
      });
    }

    setAssetMeta((prev) => {
      const i = doingRename
        ? prev.findIndex((m) => sameBasiswertBucket(m.name, renameTrim))
        : prev.findIndex((m) => sameBasiswertBucket(m.name, canon));
      const merged: AssetMeta =
        i >= 0
          ? {
              ...prev[i],
              ...patchNorm,
              name: canon
            }
          : { ...patchNorm };
      const next = i >= 0 ? prev.map((m, idx) => (idx === i ? merged : m)) : [...prev, merged];
      const deduped = normalizeAndMergeAssetMetaList(next).next;
      saveAssetMetaToStorage(deduped);
      return deduped;
    });
  };

  const runMergeDuplicateBasiswerte = () => {
    const { next: nextTrades, substitutions } = applyBasiswertMergeToTrades(trades);
    const { next: nextMeta, mergedPairs } = normalizeAndMergeAssetMetaList(assetMeta);
    setTrades(nextTrades);
    setAssetMeta(nextMeta);
    saveTradesToStorage(nextTrades);
    saveAssetMetaToStorage(nextMeta);
    window.alert(
      `${t(appSettings.language, "mergeDoneTitle")}\n\n${t(appSettings.language, "mergeDoneBody", { substitutions, mergedPairs })}`
    );
  };

  const applySingleReconcileSuggestion = (rowId: string) => {
    const row = reconcileRows.find((r) => r.id === rowId);
    if (!row?.suggestion) return;
    if (row.kind === "trade") {
      const tradeId = row.id.replace(/^trade:/, "");
      setTrades((prev) => {
        const next = prev.map((trade) =>
          trade.id === tradeId
            ? {
                ...trade,
                isin: row.suggestion?.isin ?? trade.isin,
                wkn: row.suggestion?.wkn ?? trade.wkn
              }
            : trade
        );
        saveTradesToStorage(next);
        return next;
      });
      return;
    }
    const key = row.id.replace(/^asset:/, "");
    setAssetMeta((prev) => {
      const next = prev.map((meta) =>
        meta.name.toLowerCase() === key
          ? {
              ...meta,
              isin: row.suggestion?.isin ?? meta.isin,
              wkn: row.suggestion?.wkn ?? meta.wkn
            }
          : meta
      );
      saveAssetMetaToStorage(next);
      return next;
    });
  };

  const applyAllReconcileSuggestions = () => {
    const openRows = reconcileRows.filter((r) => r.status !== "ok" && r.suggestion);
    if (openRows.length === 0) return;

    const tradeMap = new Map(
      openRows
        .filter((r) => r.kind === "trade")
        .map((r) => [
          r.id.replace(/^trade:/, ""),
          {
            isin: r.suggestion?.isin,
            wkn: r.suggestion?.wkn
          }
        ])
    );
    const assetMap = new Map(
      openRows
        .filter((r) => r.kind === "asset")
        .map((r) => [
          r.id.replace(/^asset:/, ""),
          {
            isin: r.suggestion?.isin,
            wkn: r.suggestion?.wkn
          }
        ])
    );

    if (tradeMap.size > 0) {
      setTrades((prev) => {
        const next = prev.map((trade) => {
          const patch = tradeMap.get(trade.id);
          return patch
            ? {
                ...trade,
                isin: patch.isin ?? trade.isin,
                wkn: patch.wkn ?? trade.wkn
              }
            : trade;
        });
        saveTradesToStorage(next);
        return next;
      });
    }

    if (assetMap.size > 0) {
      setAssetMeta((prev) => {
        const next = prev.map((meta) => {
          const patch = assetMap.get(meta.name.toLowerCase());
          return patch
            ? {
                ...meta,
                isin: patch.isin ?? meta.isin,
                wkn: patch.wkn ?? meta.wkn
              }
            : meta;
        });
        saveAssetMetaToStorage(next);
        return next;
      });
    }
  };

  const applyKnownTickerSuggestions = () => {
    const { nextMeta, applied, stillWithoutChartSymbol } = enrichAssetMetaFromKnownTickers(trades, assetMeta);
    setAssetMeta(nextMeta);
    saveAssetMetaToStorage(nextMeta);
    const lang = appSettings.language;
    window.alert(
      `${t(lang, "tickerDoneTitle")}\n\n${t(lang, "alertTickerApplied", {
        n: applied.length,
        list: applied.join(", ") || t(lang, "noneDash")
      })}\n\n${t(lang, "alertTickerStill", {
        n: stillWithoutChartSymbol.length,
        list: stillWithoutChartSymbol.join(", ") || t(lang, "noneDash")
      })}\n\n${t(lang, "alertTickerFooter")}`
    );
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
    const header = ["name", "category", "ticker", "währung", "tradesCount", "realizedPL", "openCapital"];
    const rows = assetRowsWithMeta.map((asset) => [
      asset.name,
      asset.category,
      asset.ticker ?? "",
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
    const header = ["name", "category", "ticker", "währung", "tradesCount", "realizedPL", "openCapital"];
    const rows = assetRowsWithMeta.map((asset) => [
      asset.name,
      asset.category,
      asset.ticker ?? "",
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
  const steuerpflichtigerGewinn = Math.max(0, verkaufTransaktion - kaufTransaktion);
  const isTaxCorrectionType = form.typ === "Steuerkorrektur";
  const isInterestType = form.typ === "Zinszahlung";
  const isDividendType = form.typ === "Dividende";
  const isIncomeType = isInterestType || isDividendType;
  const explicitTaxInput = Number.parseFloat(form.verkaufSteuern);
  const incomeGrossInput = form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell) ? verkaufTransaktionManuell : 0;
  const sellAmountInput =
    form.verkaufPreisManuell.trim() !== "" && Number.isFinite(verkaufPreisManuell)
      ? verkaufPreisManuell
      : form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell)
      ? verkaufTransaktionManuell
      : stueck > 0 && verkaufStueckpreis > 0
      ? verkaufTransaktion
      : 0;
  const verkaufSteuern = isTaxCorrectionType
    ? form.verkaufSteuern.trim() !== ""
      ? Number.isFinite(explicitTaxInput)
        ? explicitTaxInput
        : 0
      : sellAmountInput
    : isIncomeType
    ? form.verkaufSteuern.trim() !== ""
      ? (() => {
          const parsed = Number.parseFloat(form.verkaufSteuern);
          if (!Number.isFinite(parsed)) return 0;
          return parsed > 0 ? -parsed : parsed;
        })()
      : -incomeGrossInput * (isInterestType ? 0.2 : 0.275)
    : form.verkaufSteuern.trim() === ""
    ? -steuerpflichtigerGewinn * 0.275
    : (() => {
        const parsed = Number.parseFloat(form.verkaufSteuern);
        if (!Number.isFinite(parsed)) return 0;
        // Für normale Trades/Dividende/Zins: positive Eingabe als Steuerzahlung interpretieren.
        return parsed > 0 ? -parsed : parsed;
      })();
  const kaufPreis = form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuell) ? kaufPreisManuell : kaufTransaktion + kaufGebuehren;
  const verkaufGebuehrenEffective = isIncomeType ? 0 : verkaufGebuehren;
  const verkaufErlosVorSteuerAutomatisch = stueck > 0 ? verkaufTransaktion - verkaufGebuehrenEffective : 0;
  const verkaufErlosVorSteuer =
    form.verkaufPreisManuell.trim() !== "" && Number.isFinite(verkaufPreisManuell) ? verkaufPreisManuell : verkaufErlosVorSteuerAutomatisch;
  const incomeNet = incomeGrossInput + verkaufSteuern;
  const verkaufPreis = isTaxCorrectionType ? 0 : isIncomeType ? incomeNet : verkaufErlosVorSteuer + verkaufSteuern;
  const statusClosed = isTaxCorrectionType || isIncomeType ? !!form.kaufzeitpunkt : !!form.verkaufszeitpunkt;
  const isCashflowType = ["Steuerkorrektur", "Zinszahlung", "Dividende"].includes(form.typ);
  const isNoBasiswertType = form.typ === "Steuerkorrektur" || form.typ === "Zinszahlung";
  const hasKaufData =
    (form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuell)) ||
    (form.kaufTransaktionManuell.trim() !== "" && Number.isFinite(kaufTransaktionManuell)) ||
    (stueck > 0 && kaufStueckpreis > 0);
  const kaufPreisEffective = isCashflowType && !hasKaufData ? 0 : kaufPreis;
  const kaufGebuehrenEffective = isCashflowType && !hasKaufData ? 0 : kaufGebuehren;

  const gewinn = statusClosed ? verkaufPreis - kaufPreisEffective : 0;
  const differenz = statusClosed ? (isIncomeType ? incomeGrossInput : verkaufErlosVorSteuer - kaufPreisEffective) : 0;
  const steuerBetrag = statusClosed ? verkaufSteuern : 0;
  const rendite = kaufPreisEffective > 0 ? (gewinn / kaufPreisEffective) * 100 : 0;
  const haltedauer = statusClosed ? daysBetween(form.kaufzeitpunkt, form.verkaufszeitpunkt) : 0;

  const hasVerkaufData =
    (form.verkaufPreisManuell.trim() !== "" && Number.isFinite(verkaufPreisManuell)) ||
    (form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell)) ||
    (stueck > 0 && verkaufStueckpreis > 0) ||
    (form.verkaufSteuern.trim() !== "" && Number.isFinite(explicitTaxInput));

  const canSaveTrade = isTaxCorrectionType
    ? !!form.name.trim() &&
      !!form.kaufzeitpunkt &&
      form.verkaufSteuern.trim() !== "" &&
      Number.isFinite(explicitTaxInput)
    : isIncomeType
    ? !!form.name.trim() &&
      (isNoBasiswertType || !!form.basiswert.trim()) &&
      !!form.kaufzeitpunkt &&
      form.verkaufTransaktionManuell.trim() !== "" &&
      Number.isFinite(verkaufTransaktionManuell) &&
      verkaufTransaktionManuell > 0
    : isCashflowType
    ? !!form.name.trim() && (isNoBasiswertType || !!form.basiswert.trim()) && !!form.verkaufszeitpunkt && hasVerkaufData
    : !!form.name.trim() &&
      !!form.basiswert.trim() &&
      !!form.kaufzeitpunkt &&
      stueck > 0 &&
      kaufStueckpreis > 0 &&
      kaufPreis > 0;

  const persistTradeFromForm = (finalize: boolean): boolean => {
    if (!canSaveTrade) return false;
    const effectiveId = editingTradeId ?? (newTradeDraftIdRef.current ?? `trade-${Date.now()}`);
    if (!editingTradeId) newTradeDraftIdRef.current = effectiveId;
    const next: Trade = {
      id: effectiveId,
      name: form.name.trim(),
      typ: form.typ,
      basiswert: isNoBasiswertType ? "" : canonicalizeBasiswert(form.basiswert.trim()),
      isin: form.isin.trim() || undefined,
      wkn: form.wkn.trim().toUpperCase() || undefined,
      notiz: form.notiz.trim() || undefined,
      kaufzeitpunkt: toDisplayDateTime(form.kaufzeitpunkt),
      kaufPreis: isTaxCorrectionType || isIncomeType ? 0 : kaufPreisEffective,
      stueck: isTaxCorrectionType || isIncomeType ? undefined : stueck > 0 ? stueck : undefined,
      kaufStueckpreis: isTaxCorrectionType || isIncomeType ? undefined : kaufStueckpreis > 0 ? kaufStueckpreis : undefined,
      kaufTransaktionManuell:
        isTaxCorrectionType || isIncomeType ? undefined : form.kaufTransaktionManuell.trim() !== "" && Number.isFinite(kaufTransaktionManuell) ? kaufTransaktionManuell : undefined,
      kaufGebuehren: isTaxCorrectionType || isIncomeType ? 0 : kaufGebuehrenEffective,
      kaufPreisManuell: isTaxCorrectionType || isIncomeType ? undefined : form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuell) ? kaufPreisManuell : undefined,
      verkaufszeitpunkt: isTaxCorrectionType || isIncomeType ? undefined : statusClosed ? toDisplayDateTime(form.verkaufszeitpunkt) : undefined,
      verkaufPreis: statusClosed ? verkaufPreis : undefined,
      verkaufStueckpreis: isTaxCorrectionType || isIncomeType ? undefined : statusClosed && verkaufStueckpreis > 0 ? verkaufStueckpreis : undefined,
      verkaufTransaktionManuell:
        isTaxCorrectionType
          ? undefined
          : isIncomeType
          ? statusClosed && form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell)
            ? verkaufTransaktionManuell
            : undefined
          : statusClosed && form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuell)
          ? verkaufTransaktionManuell
          : undefined,
      verkaufSteuern: statusClosed ? verkaufSteuern : undefined,
      verkaufGebuehren: statusClosed ? verkaufGebuehrenEffective : undefined,
      verkaufPreisManuell:
        isTaxCorrectionType || isIncomeType
          ? undefined
          : statusClosed && form.verkaufPreisManuell.trim() !== "" && Number.isFinite(verkaufPreisManuell)
          ? verkaufPreisManuell
          : undefined,
      gewinn: statusClosed ? gewinn : undefined,
      status: statusClosed ? "Geschlossen" : "Offen"
    };
    setTrades((prev) => {
      const exists = prev.some((trade) => trade.id === effectiveId);
      const updated = exists ? prev.map((trade) => (trade.id === effectiveId ? next : trade)) : [next, ...prev];
      saveTradesToStorage(updated);
      return updated;
    });
    if (finalize) {
      newTradeDraftIdRef.current = null;
      setForm(makeDefaultTradeForm());
      setEditingTradeId(null);
      setView("trades");
    }
    return true;
  };

  const saveNewTrade = () => {
    persistTradeFromForm(true);
  };

  const autoSaveTradeRef = useRef<() => void>(() => {});
  autoSaveTradeRef.current = () => {
    persistTradeFromForm(false);
  };

  useEffect(() => {
    if (view !== "newTrade") return;
    const id = window.setInterval(() => autoSaveTradeRef.current(), 10_000);
    return () => window.clearInterval(id);
  }, [view]);

  const cancelNewTradeView = () => {
    const draftId = newTradeDraftIdRef.current;
    if (draftId && !editingTradeId) {
      setTrades((prev) => {
        const next = prev.filter((trade) => trade.id !== draftId);
        saveTradesToStorage(next);
        return next;
      });
    }
    newTradeDraftIdRef.current = null;
    setForm(makeDefaultTradeForm());
    setEditingTradeId(null);
  };

  const startNewTrade = () => {
    newTradeDraftIdRef.current = null;
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
      "isin",
      "wkn",
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
      trade.isin,
      trade.wkn,
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
    const json = buildAppBackupJson({
      trades,
      assetMeta,
      appSettings,
      theme,
      journal: journalData,
      aiKnowledgeBase
    });
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trading-dashboard-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const deleteTrade = (id: string) => {
    if (appSettings.confirmBeforeDelete) {
      const confirmed = window.confirm(t(appSettings.language, "deleteTradeConfirm"));
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
    newTradeDraftIdRef.current = null;
    const qty = trade.stueck && trade.stueck > 0 ? trade.stueck : 1;
    setEditingTradeId(trade.id);
    setForm({
      name: trade.name,
      typ: trade.typ,
      basiswert: trade.basiswert,
      isin: trade.isin ?? "",
      wkn: trade.wkn ?? "",
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
  const resetTradesFilters = () => {
    setSearch("");
    setStatusFilter("Alle");
    setTypFilter([]);
    setBasiswertFilter([]);
    setRangeFilter("Alle");
    setCalendarRangeStart(null);
    setCalendarRangeEnd(null);
  };

  const handleAuthSubmit = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError(null);
    const email = authEmail.trim();
    try {
      if (authMode === "register") {
        const { error } = await supabase.auth.signUp({ email, password: authPassword });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentifizierung fehlgeschlagen.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCloudReady(false);
  };

  if (!supabaseConfigured) {
    return (
      <div className="layout auth-layout">
        <main className="content auth-page">
          <section className="card auth-card auth-setup-card">
            <h1>Supabase konfigurieren</h1>
            <p>Bitte trage in deiner .env folgende Variablen ein und starte die App neu:</p>
            <p><code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code>.</p>
          </section>
        </main>
      </div>
    );
  }

  if (authLoading || cloudHydrating) {
    return (
      <div className="layout auth-layout">
        <main className="content auth-page">
          <section className="card auth-card auth-loading-card">
            <p>Lade Cloud-Daten ...</p>
          </section>
        </main>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="layout auth-layout">
        <main className="content auth-page">
          <section className="card auth-card">
            <div className="auth-head">
              <h1>{authMode === "login" ? "Willkommen zurück" : "Konto erstellen"}</h1>
              <p>Logge dich ein, damit deine Daten automatisch über alle Geräte synchron bleiben.</p>
            </div>
            <div className="auth-form-grid">
              <label>
                <span className="field-title">E-Mail</span>
                <input
                  type="email"
                  placeholder="name@beispiel.de"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </label>
              <label>
                <span className="field-title">Passwort</span>
                <input
                  type="password"
                  placeholder="Mindestens 6 Zeichen"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
              </label>
              <div className="auth-actions">
                <button
                  className="primary"
                  onClick={handleAuthSubmit}
                  disabled={authBusy || !authEmail.trim() || !authPassword}
                >
                  {authBusy ? "Bitte warten ..." : authMode === "login" ? "Einloggen" : "Account erstellen"}
                </button>
                <button
                  className="secondary"
                  onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}
                  disabled={authBusy}
                >
                  {authMode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Einloggen"}
                </button>
              </div>
              {authError && <p className="auth-error">{authError}</p>}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <SidebarNav
        view={view}
        onViewChange={handleViewChange}
        theme={theme}
        onThemeChange={setTheme}
        language={appSettings.language}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((current) => !current)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />
      <main className="content">
        <div className="auth-topbar">
          <button className="secondary slim" onClick={handleLogout}>Logout</button>
        </div>
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
            onResetFilters={resetTradesFilters}
            availableTypes={availableTypes}
            availableBasiswerte={availableBasiswerte}
            sortMarker={sortMarker}
            onToggleSort={toggleSort}
            onImportTradesFile={importTradesFile}
            onDownloadImportTemplateCsv={downloadImportTemplateCsv}
            onDownloadImportTemplateExcel={downloadImportTemplateExcel}
            onExportTradesCsvForExcel={exportTradesCsvForExcel}
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
            traderProviders={appSettings.traderProviders}
          />
        )}
        {view === "newTrade" && (
          <NewTradeView
            editingTradeId={editingTradeId}
            language={appSettings.language}
            financeService={appSettings.financeService}
            trades={trades}
            assetMeta={assetMeta}
            chartTheme={theme}
            form={form}
            setForm={setForm}
            statusClosed={statusClosed}
            differenz={differenz}
            steuerBetrag={steuerBetrag}
            gewinn={gewinn}
            rendite={rendite}
            haltedauer={haltedauer}
            canSaveTrade={canSaveTrade}
            onSaveNewTrade={saveNewTrade}
            onSetViewTrades={() => setView("trades")}
            onCancelNewTradeView={cancelNewTradeView}
          />
        )}
        {view === "assets" && (
          <AssetsView
            language={appSettings.language}
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
            chartTheme={theme}
            onSaveAssetMeta={saveAssetMetaPatch}
            traderProviders={appSettings.traderProviders}
          />
        )}
        {view === "journal" && (
          <JournalView
            language={appSettings.language}
            journalData={journalData}
            trades={trades}
            onJournalDayChange={handleJournalDayChange}
            onJournalWeekChange={handleJournalWeekChange}
            onJournalMonthChange={handleJournalMonthChange}
            onEditTrade={editTrade}
            onDeleteTrade={deleteTrade}
          />
        )}
        {view === "aiAssistant" && (
          <AiAssistantView
            language={appSettings.language}
            settings={appSettings}
            trades={trades}
            journalData={journalData}
            onOpenJournal={() => setView("journal")}
            onOpenSettings={() => setView("settings")}
            onOpenAiRoadmap={() => setView("aiAssistantPlan")}
            onAppendAiToJournal={handleAppendAiToJournal}
            aiKnowledgeBase={aiKnowledgeBase}
            onAiKnowledgeBaseChange={handleAiKnowledgeBaseChange}
          />
        )}
        {view === "aiAssistantPlan" && (
          <AiAssistantPlanView
            language={appSettings.language}
            onBackToAssistant={() => setView("aiAssistant")}
            onOpenJournal={() => setView("journal")}
          />
        )}
        {view === "isinLive" && <IsinLiveView language={appSettings.language} chartTheme={theme} />}
        {view === "analytics" && analyticsData && (
          <AnalyticsView
            language={appSettings.language}
            analyticsData={analyticsData}
            analyticsTab={analyticsTab}
            onAnalyticsTabChange={setAnalyticsTab}
            trades={trades}
            onBackToTrades={() => setView("trades")}
          />
        )}
        {view === "settings" && (
          <SettingsView
            settings={appSettings ?? defaultAppSettings}
            onSettingsChange={setAppSettings}
            onApplyTheme={setTheme}
            currentTheme={theme}
            t={(key) => t(appSettings.language, key)}
            onImportBackupFile={importTradesFile}
            onExportJsonBackup={exportTradesJsonBackup}
            onApplyKnownTickerSuggestions={applyKnownTickerSuggestions}
            knownTickerSuggestionCount={countKnownTickerKeys()}
            onMergeDuplicateBasiswerte={runMergeDuplicateBasiswerte}
            basiswertMergePreview={basiswertMergePreview}
            reconcileRows={reconcileRows}
            onApplyReconcileSuggestion={applySingleReconcileSuggestion}
            onApplyAllReconcileSuggestions={applyAllReconcileSuggestions}
          />
        )}
      </main>
    </div>
  );
}
