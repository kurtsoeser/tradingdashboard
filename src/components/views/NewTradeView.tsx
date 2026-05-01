import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CandlestickChart, ChartCandlestick, Clock3, ExternalLink, FileText, HandCoins, Info, Landmark, Layers, Save, Search, Tags, TrendingUp } from "lucide-react";
import {
  formatDateTimeAT,
  formatMonthLabel,
  getNowLocalDateTimeValue,
  parseStoredDateTime
} from "../../app/date";
import { t } from "../../app/i18n";
import type { AssetDisplayRow, AssetMeta, NewTradeForm, TradeFormType } from "../../app/types";
import { getTradeRealizedPL, isTradeClosed, money } from "../../lib/analytics";
import { canonicalizeBasiswert, sameBasiswertBucket } from "../../lib/basiswertCanonical";
import { lookupKnownTickerSuggestionDual } from "../../data/knownAssetTickers";
import { assetToTradingViewSymbol } from "../../lib/tradingViewSymbol";
import { searchByIsinOpenFigi, tradingViewSymbolFromOpenFigiHit } from "../../lib/openFigiSearch";
import { resolvePlainTickerForTradingView } from "../../data/tickerTradingViewAliases";
import type { AppSettings } from "../../app/settings";
import { buildFinanceSearchUrl } from "../../lib/financeLinks";
import type { Trade, TradePositionBooking, TradePositionBookingKind } from "../../types/trade";
import { emptyBookingRow, tradeFormAggregatesFromBookings } from "../../lib/bookingsDraft";
import { formatDecimalForForm, parseLocaleDecimal } from "../../lib/numberLocale";
import { PageHeader } from "../PageHeader";
import { ErtragEingabeEditor } from "./ErtragEingabeEditor";
import { SteuerkorrekturEditor } from "./SteuerkorrekturEditor";
import { TradingViewLiveChart } from "../TradingViewLiveChart";

function isDerivativeTradeTyp(typ: string): boolean {
  return typ === "Long" || typ === "Short" || typ === "Derivat";
}

function bookingKindLabel(language: AppSettings["language"], kind: TradePositionBookingKind): string {
  if (kind === "BUY") return t(language, "buy");
  if (kind === "SELL") return t(language, "sell");
  if (kind === "INCOME") return t(language, "incomeBooking");
  return t(language, "cloudBookingKindTaxCorr");
}

function financeProviderLabel(language: AppSettings["language"], service: AppSettings["financeService"]): string {
  switch (service) {
    case "yahoo":
      return t(language, "financeProviderYahoo");
    case "tradingview":
      return t(language, "financeProviderTradingview");
    case "investing":
      return t(language, "financeProviderInvesting");
    case "google":
    default:
      return t(language, "financeProviderGoogle");
  }
}

interface NewTradeViewProps {
  editingTradeId: string | null;
  editingTradeManualChecked: boolean;
  language: AppSettings["language"];
  financeService: AppSettings["financeService"];
  trades: Trade[];
  assetMeta: AssetMeta[];
  chartTheme: "dark" | "light";
  form: NewTradeForm;
  setForm: React.Dispatch<React.SetStateAction<NewTradeForm>>;
  statusClosed: boolean;
  differenz: number;
  steuerBetrag: number;
  gewinn: number;
  rendite: number;
  haltedauer: number;
  canSaveTrade: boolean;
  onSaveNewTrade: () => void;
  onSetEditingTradeManualChecked: (checked: boolean) => void;
  onSetViewTrades: () => void;
  onCancelNewTradeView: () => void;
  bookingDraft: TradePositionBooking[];
  onBookingDraftChange: (rows: TradePositionBooking[]) => void;
}

export function NewTradeView({
  editingTradeId,
  editingTradeManualChecked,
  language,
  financeService,
  trades,
  assetMeta,
  chartTheme,
  form,
  setForm,
  statusClosed,
  differenz,
  steuerBetrag,
  gewinn,
  rendite,
  haltedauer,
  canSaveTrade,
  onSaveNewTrade,
  onSetEditingTradeManualChecked,
  onSetViewTrades,
  onCancelNewTradeView,
  bookingDraft,
  onBookingDraftChange
}: NewTradeViewProps) {
  const normalizeDecimalInput = (value: string) => value.replace(/,/g, ".");

  const sortBookingRowsByDateTimeAsc = (rows: TradePositionBooking[]): TradePositionBooking[] =>
    [...rows].sort((a, b) => {
      const ta = parseStoredDateTime(a.bookedAtIso)?.getTime() ?? 0;
      const tb = parseStoredDateTime(b.bookedAtIso)?.getTime() ?? 0;
      return ta - tb;
    });

  const updateBookingDraftSorted = (rows: TradePositionBooking[]) => {
    onBookingDraftChange(sortBookingRowsByDateTimeAsc(rows));
  };

  const formatDateTimeDisplay = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const dd = `${date.getDate()}`.padStart(2, "0");
    const mm = `${date.getMonth() + 1}`.padStart(2, "0");
    const yyyy = date.getFullYear();
    const hh = `${date.getHours()}`.padStart(2, "0");
    const min = `${date.getMinutes()}`.padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  };

  const parseDateTimeDisplay = (value: string) => {
    const normalized = value.trim().replace(/\s+-\s+/g, " ");
    const match = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?$/);
    if (!match) return null;
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4] ?? "0", 10);
    const minute = Number.parseInt(match[5] ?? "0", 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const date = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
    const yyyy = `${year}`;
    const mm = `${month}`.padStart(2, "0");
    const dd = `${day}`.padStart(2, "0");
    const hh = `${hour}`.padStart(2, "0");
    const min = `${minute}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const [kaufzeitpunktDisplay, setKaufzeitpunktDisplay] = useState(() => formatDateTimeDisplay(form.kaufzeitpunkt));
  const [verkaufszeitpunktDisplay, setVerkaufszeitpunktDisplay] = useState(() => formatDateTimeDisplay(form.verkaufszeitpunkt));
  const [isinLookupState, setIsinLookupState] = useState<"idle" | "loading" | "ok" | "empty" | "error">("idle");
  const [isinLiveSymbol, setIsinLiveSymbol] = useState<string | null>(null);
  /** Steuer-Spalte: Text + Locale-Parsing (type=number blockiert oft „,“ / Zwischenstände). */
  const [bookingTaxFocus, setBookingTaxFocus] = useState<{ idx: number; draft: string } | null>(null);

  const isTaxCorrectionType = form.typ === "Steuerkorrektur";
  const isInterestType = form.typ === "Zinszahlung";
  const isDividendType = form.typ === "Dividende";
  const isIncomeType = isInterestType || isDividendType;
  const isNoBasiswertType = isTaxCorrectionType || isInterestType;
  const isCashflowBookingType = ["Steuerkorrektur", "Zinszahlung", "Dividende"].includes(form.typ);
  const numberLocale = language === "en" ? "en" : "de";
  const showBookingEditor =
    !!editingTradeId && form.typ !== "Dividende" && form.typ !== "Zinszahlung" && form.typ !== "Steuerkorrektur";
  useEffect(() => {
    setBookingTaxFocus((prev) => (prev && prev.idx >= bookingDraft.length ? null : prev));
  }, [bookingDraft.length]);
  const buyTimeLabelKey = isCashflowBookingType ? "bookingDate" : "buyTime";
  const normalizedIsin = form.isin.trim().toUpperCase();
  const isValidIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalizedIsin);
  const derivativeLiveQueriesChart = isDerivativeTradeTyp(form.typ);
  const derivativeFinanceQuery = useMemo(() => {
    if (!derivativeLiveQueriesChart) return "";
    if (isValidIsin) return normalizedIsin;
    const w = form.wkn.trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(w)) return w;
    const b = form.basiswert.trim();
    if (b) return b;
    return form.name.trim();
  }, [derivativeLiveQueriesChart, isValidIsin, normalizedIsin, form.wkn, form.basiswert, form.name]);
  const showLiveChartCard =
    !isCashflowBookingType &&
    (!!form.isin.trim() || !!form.basiswert.trim() || (derivativeLiveQueriesChart && (!!form.wkn.trim() || !!form.name.trim())));

  useEffect(() => {
    setKaufzeitpunktDisplay(formatDateTimeDisplay(form.kaufzeitpunkt));
  }, [form.kaufzeitpunkt]);

  useEffect(() => {
    setVerkaufszeitpunktDisplay(formatDateTimeDisplay(form.verkaufszeitpunkt));
  }, [form.verkaufszeitpunkt]);

  /**
   * Kaufdaten / Verkaufs-Kachel aus Buchungszeilen (Bearbeitung, keine Cashflow-Typen).
   * Verkaufszeitpunkt = spätestes SELL-`bookedAt` (wie in `tradeFormAggregatesFromBookings`).
   */
  useEffect(() => {
    if (!showBookingEditor || !editingTradeId || !bookingDraft.length) return;
    if (isTaxCorrectionType || isIncomeType) return;
    const { buy, sell } = tradeFormAggregatesFromBookings(bookingDraft);
    setForm((prev) => ({
      ...prev,
      ...(buy ?? {}),
      ...(sell
        ? {
            stueckVerkauf: sell.stueckVerkauf,
            verkaufszeitpunkt: sell.verkaufszeitpunkt,
            verkaufStueckpreis: sell.verkaufStueckpreis,
            verkaufTransaktionManuell: sell.verkaufTransaktionManuell,
            verkaufGebuehren: sell.verkaufGebuehren,
            verkaufPreisManuell: sell.verkaufPreisManuell
          }
        : { stueckVerkauf: "" })
    }));
  }, [
    bookingDraft,
    editingTradeId,
    isIncomeType,
    isTaxCorrectionType,
    showBookingEditor,
    setForm
  ]);

  const commitKaufzeitpunktDisplay = () => {
    const parsed = parseDateTimeDisplay(kaufzeitpunktDisplay);
    if (!parsed) {
      setKaufzeitpunktDisplay(formatDateTimeDisplay(form.kaufzeitpunkt));
      return;
    }
    setForm((prev) => ({ ...prev, kaufzeitpunkt: parsed }));
    setKaufzeitpunktDisplay(formatDateTimeDisplay(parsed));
  };

  const commitVerkaufszeitpunktDisplay = () => {
    const parsed = parseDateTimeDisplay(verkaufszeitpunktDisplay);
    if (!parsed) {
      setVerkaufszeitpunktDisplay(formatDateTimeDisplay(form.verkaufszeitpunkt));
      return;
    }
    setForm((prev) => ({ ...prev, verkaufszeitpunkt: parsed, tradeStatus: "Geschlossen" }));
    setVerkaufszeitpunktDisplay(formatDateTimeDisplay(parsed));
  };

  const resultTintStrength = Math.min(Math.abs(rendite), 30) / 30;
  const stueckValue = Number.parseFloat(form.stueck) || 0;
  const verkaufStueckParsed = Number.parseFloat(form.stueckVerkauf);
  /** Verkaufs-Stückzahl: explizit aus Formular, sonst (neuer Trade) = Kauf-Stückzahl. */
  const verkaufStueckCount =
    form.stueckVerkauf.trim() !== "" && Number.isFinite(verkaufStueckParsed) ? verkaufStueckParsed || 0 : stueckValue;
  const kaufStueckpreisValue = Number.parseFloat(form.kaufStueckpreis) || 0;
  const kaufTransaktionManuellValue = Number.parseFloat(form.kaufTransaktionManuell);
  const kaufGebuehrenValue = Number.parseFloat(form.kaufGebuehren) || 0;
  const verkaufStueckpreisValue = Number.parseFloat(form.verkaufStueckpreis) || 0;
  const verkaufTransaktionManuellValue = Number.parseFloat(form.verkaufTransaktionManuell);
  const kaufTransaktionValue =
    form.kaufTransaktionManuell.trim() !== "" && Number.isFinite(kaufTransaktionManuellValue) ? kaufTransaktionManuellValue : stueckValue > 0 ? stueckValue * kaufStueckpreisValue : 0;
  const verkaufTransaktionValue =
    form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuellValue)
      ? verkaufTransaktionManuellValue
      : verkaufStueckCount > 0
        ? verkaufStueckCount * verkaufStueckpreisValue
        : 0;
  const steuerpflichtigerGewinnValue = Math.max(0, verkaufTransaktionValue - kaufTransaktionValue);
  const verkaufSteuernFormStr = String(form.verkaufSteuern ?? "").trim();
  const verkaufSteuernValue =
    verkaufSteuernFormStr === ""
      ? steuerpflichtigerGewinnValue * 0.275
      : (parseLocaleDecimal(verkaufSteuernFormStr, numberLocale) ?? Number.parseFloat(verkaufSteuernFormStr)) || 0;
  const verkaufGebuehrenValue = Number.parseFloat(form.verkaufGebuehren) || 0;
  const kaufPreisCalculated = stueckValue > 0 ? kaufTransaktionValue + kaufGebuehrenValue : 0;
  const kaufPreisManuellValue = Number.parseFloat(form.kaufPreisManuell);
  const kaufPreisEffektiv =
    form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuellValue) ? kaufPreisManuellValue : kaufPreisCalculated;
  const verkaufserloesCalculated = verkaufStueckCount > 0 ? verkaufTransaktionValue - verkaufGebuehrenValue : 0;
  const basiswertStats = useMemo(() => {
    const normalizedBasiswert = form.basiswert.trim().toLowerCase();
    if (!normalizedBasiswert) return null;

    const relatedTrades = trades.filter((trade) => trade.basiswert.trim().toLowerCase() === normalizedBasiswert);
    if (relatedTrades.length === 0) {
      return {
        basiswertLabel: form.basiswert.trim(),
        totalTrades: 0,
        closedTrades: 0,
        offeneTrades: 0,
        winRate: 0,
        avgPL: 0,
        totalPL: 0,
        perfSeries: [] as Array<{ label: string; value: number }>,
        monthlySeries: [] as Array<{ label: string; value: number }>
      };
    }

    const sortedByDate = [...relatedTrades].sort((a, b) => {
      const timeA = parseStoredDateTime(a.kaufzeitpunkt)?.getTime() ?? 0;
      const timeB = parseStoredDateTime(b.kaufzeitpunkt)?.getTime() ?? 0;
      return timeA - timeB;
    });
    const closedTrades = sortedByDate.filter((trade) => isTradeClosed(trade));
    const offeneTrades = sortedByDate.length - closedTrades.length;
    const totalPL = closedTrades.reduce((sum, trade) => sum + getTradeRealizedPL(trade), 0);
    const winners = closedTrades.filter((trade) => getTradeRealizedPL(trade) > 0).length;
    const winRate = closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0;
    const avgPL = closedTrades.length > 0 ? totalPL / closedTrades.length : 0;

    let runningPL = 0;
    const perfSeries = closedTrades.slice(-10).map((trade, index) => {
      runningPL += getTradeRealizedPL(trade);
      return {
        label: `${index + 1}`,
        value: runningPL
      };
    });

    const monthlyMap = new Map<string, number>();
    closedTrades.forEach((trade) => {
      const date = parseStoredDateTime(trade.verkaufszeitpunkt ?? trade.kaufzeitpunkt);
      if (!date) return;
      const monthKey = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + getTradeRealizedPL(trade));
    });
    const monthlySeries = [...monthlyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([monthKey, value]) => ({ label: formatMonthLabel(monthKey), value }));

    return {
      basiswertLabel: sortedByDate[0]?.basiswert || form.basiswert.trim(),
      totalTrades: sortedByDate.length,
      closedTrades: closedTrades.length,
      offeneTrades,
      winRate,
      avgPL,
      totalPL,
      perfSeries,
      monthlySeries
    };
  }, [form.basiswert, trades]);

  const basiswertLiveTvSymbol = useMemo(() => {
    const raw = form.basiswert.trim();
    if (!raw) return null;
    const canon = canonicalizeBasiswert(raw);
    const meta = assetMeta.find((m) => sameBasiswertBucket(m.name, canon));
    const tickerKnown = lookupKnownTickerSuggestionDual(canon, raw)?.ticker?.trim();
    const ticker = (meta?.ticker?.trim() || tickerKnown) ?? "";
    if (!ticker) return null;
    const row: AssetDisplayRow = {
      name: canon,
      category: meta?.category ?? "Aktie",
      tradesCount: 0,
      realizedPL: 0,
      openCapital: 0,
      hasOpen: false,
      ticker,
      waehrung: meta?.waehrung
    };
    return assetToTradingViewSymbol(row);
  }, [form.basiswert, assetMeta]);

  /** Bei Long/Short/Derivat nur Basiswert/Metadaten (ISIN = Produkt, nicht Underlying). Sonst zusätzlich ISIN-Fallback. */
  const basisChartTvSymbol = useMemo(() => {
    if (derivativeLiveQueriesChart) return basiswertLiveTvSymbol ?? null;
    return basiswertLiveTvSymbol ?? isinLiveSymbol ?? null;
  }, [derivativeLiveQueriesChart, basiswertLiveTvSymbol, isinLiveSymbol]);
  const basisChartUsesIsinFallback = !derivativeLiveQueriesChart && !basiswertLiveTvSymbol && !!isinLiveSymbol;

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    if (!isValidIsin) {
      setIsinLookupState(normalizedIsin ? "empty" : "idle");
      setIsinLiveSymbol(null);
      return () => controller.abort();
    }
    setIsinLookupState("loading");
    setIsinLiveSymbol(null);
    void searchByIsinOpenFigi(normalizedIsin, controller.signal)
      .then((hits) => {
        if (aborted) return;
        const first = hits[0];
        const symbol = first ? tradingViewSymbolFromOpenFigiHit(first) : null;
        setIsinLiveSymbol(symbol);
        setIsinLookupState(hits.length > 0 ? "ok" : "empty");
      })
      .catch(() => {
        if (aborted) return;
        setIsinLookupState("error");
        setIsinLiveSymbol(null);
      });
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [normalizedIsin, isValidIsin]);

  const renderMiniBars = (data: Array<{ label: string; value: number }>, mode: "pl" | "count") => {
    if (data.length === 0) {
      return <p className="asset-history-empty">Noch nicht genug Daten.</p>;
    }
    const maxAbs = Math.max(...data.map((point) => Math.abs(point.value)), 1);
    return (
      <div className="asset-history-bars" role="img" aria-label={mode === "pl" ? "P&L Verlauf" : "Monatsverlauf"}>
        {data.map((point) => {
          const ratio = Math.max(8, (Math.abs(point.value) / maxAbs) * 100);
          const directionClass = point.value >= 0 ? "is-positive" : "is-negative";
          return (
            <div key={`${mode}-${point.label}`} className="asset-history-bar-row">
              <span className="asset-history-bar-label">{point.label}</span>
              <div className="asset-history-bar-track">
                <div className={`asset-history-bar-fill ${directionClass}`} style={{ width: `${ratio}%` }} />
              </div>
              <span className={`asset-history-bar-value ${directionClass}`}>{mode === "pl" ? money(point.value) : `${point.value}`}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const preisSzenario = useMemo(() => {
    const kauf = kaufPreisEffektiv;
    if (kauf <= 0) return [];
    const changes = [-15, -10, -5, 0, 5, 10, 15];
    return changes.map((percent) => {
      const verkauf = kauf * (1 + percent / 100);
      const pnl = verkauf - kauf;
      return { label: `${percent > 0 ? "+" : ""}${percent}%`, value: pnl };
    });
  }, [kaufPreisEffektiv]);

  /** Live-Chart unter Kauf/Verkauf/Ergebnis (2/3 Rasterbreite, etwas höher). */
  const liveChartEmbedHeight = 500;

  const handleStueckChange = (nextStueck: string) => {
    setForm((prev) => {
      const qty = Number.parseFloat(nextStueck) || 0;
      const next: NewTradeForm = { ...prev, stueck: nextStueck };
      if (!showBookingEditor) {
        next.stueckVerkauf = nextStueck;
      }
      const buyTxManual = Number.parseFloat(prev.kaufTransaktionManuell);
      if (prev.kaufTransaktionManuell.trim() !== "" && Number.isFinite(buyTxManual) && qty > 0) {
        next.kaufStueckpreis = (buyTxManual / qty).toFixed(6);
      }
      const sellTxManual = Number.parseFloat(prev.verkaufTransaktionManuell);
      const sellQtyForPreis = showBookingEditor ? Number.parseFloat(prev.stueckVerkauf) || 0 : qty;
      if (prev.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(sellTxManual) && sellQtyForPreis > 0) {
        next.verkaufStueckpreis = (sellTxManual / sellQtyForPreis).toFixed(6);
      }
      return next;
    });
  };

  const handleVerkaufStueckChange = (nextVerkaufStueck: string) => {
    if (showBookingEditor) return;
    setForm((prev) => {
      const qv = Number.parseFloat(nextVerkaufStueck) || 0;
      const next: NewTradeForm = { ...prev, stueckVerkauf: nextVerkaufStueck };
      const sellTxManual = Number.parseFloat(prev.verkaufTransaktionManuell);
      if (prev.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(sellTxManual) && qv > 0) {
        next.verkaufStueckpreis = (sellTxManual / qv).toFixed(6);
      }
      return next;
    });
  };

  const handleDifferenzInput = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      setForm((prev) => ({ ...prev, verkaufPreisManuell: "" }));
      return;
    }
    const nextSellPrice = kaufPreisEffektiv + parsed;
    setForm((prev) => ({ ...prev, verkaufPreisManuell: nextSellPrice.toFixed(2) }));
  };

  const handleGewinnInput = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      setForm((prev) => ({ ...prev, verkaufPreisManuell: "" }));
      return;
    }
    const nextSellPrice = kaufPreisEffektiv + parsed - verkaufSteuernValue;
    setForm((prev) => ({ ...prev, verkaufPreisManuell: nextSellPrice.toFixed(2) }));
  };

  const handleRenditeInput = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || kaufPreisEffektiv <= 0) {
      setForm((prev) => ({ ...prev, verkaufPreisManuell: "" }));
      return;
    }
    const nextGewinn = kaufPreisEffektiv * (parsed / 100);
    const nextSellPrice = kaufPreisEffektiv + nextGewinn - verkaufSteuernValue;
    setForm((prev) => ({ ...prev, verkaufPreisManuell: nextSellPrice.toFixed(2) }));
  };

  const handleRecalculateResult = () => {
    setForm((prev) => {
      if (isTaxCorrectionType) {
        // Bei Steuerkorrektur existiert nur das Steuerfeld; kein automatischer "Neuaufbau" aus Kauf/Verkauf.
        return prev;
      }
      if (isIncomeType) {
        // Bei Dividende/Zins bleibt die Bruttobuchung erhalten; Steuer wird auf Auto-Berechnung zurückgesetzt.
        return { ...prev, verkaufSteuern: "" };
      }
      // Normale Trades: Ergebnis wieder vollständig aus Kauf-/Verkaufsdaten ableiten.
      return {
        ...prev,
        verkaufPreisManuell: "",
        verkaufSteuern: ""
      };
    });
  };

  const renderResultLabel = (label: string, formulaHint: string) => (
    <span className="field-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {label}
      <span title={formulaHint} aria-label={formulaHint} style={{ display: "inline-flex", alignItems: "center", color: "var(--muted)" }}>
        <Info size={12} />
      </span>
    </span>
  );

  return (
    <section className="section new-trade">
      <PageHeader
        title={
          isTaxCorrectionType
            ? t(language, "taxCorrectionPageTitle")
            : isDividendType
              ? t(language, "dividendPageTitle")
              : isInterestType
                ? t(language, "interestPageTitle")
                : editingTradeId
                  ? t(language, "editTradeTitle")
                  : t(language, "newTradeTitle")
        }
        subtitle={
          isTaxCorrectionType
            ? t(language, "taxCorrectionPageSubtitle")
            : isDividendType
              ? t(language, "dividendPageSubtitle")
              : isInterestType
                ? t(language, "interestPageSubtitle")
                : editingTradeId
                  ? t(language, "editTradeSubtitle")
                  : t(language, "newTradeSubtitle")
        }
        actions={
          <>
            <button className="secondary" type="button" onClick={onSetViewTrades}>
              <CandlestickChart size={14} />
              {t(language, "toTrades")}
            </button>
            {editingTradeId ? (
              <label className="header-inline-checkbox">
                <input
                  type="checkbox"
                  checked={editingTradeManualChecked}
                  onChange={(e) => onSetEditingTradeManualChecked(e.target.checked)}
                />
                <span>{t(language, "manualChecked")}</span>
              </label>
            ) : null}
            <button className="primary" type="button" onClick={onSaveNewTrade} disabled={!canSaveTrade}>
              <Save size={14} />
              {editingTradeId ? t(language, "saveChanges") : t(language, "save")}
            </button>
          </>
        }
      />

      {isTaxCorrectionType ? (
        <>
          <SteuerkorrekturEditor
            language={language}
            form={form}
            setForm={setForm}
            kaufzeitpunktDisplay={kaufzeitpunktDisplay}
            setKaufzeitpunktDisplay={setKaufzeitpunktDisplay}
            commitKaufzeitpunktDisplay={commitKaufzeitpunktDisplay}
          />
          <div className="new-trade-actions">
            <button className="primary" type="button" onClick={onSaveNewTrade} disabled={!canSaveTrade}>
              {editingTradeId ? t(language, "saveChanges") : t(language, "save")}
            </button>
            <button className="secondary" type="button" onClick={onCancelNewTradeView}>
              {t(language, "cancel")}
            </button>
          </div>
        </>
      ) : isIncomeType ? (
        <>
          <ErtragEingabeEditor
            language={language}
            variant={isDividendType ? "Dividende" : "Zinszahlung"}
            form={form}
            setForm={setForm}
            kaufzeitpunktDisplay={kaufzeitpunktDisplay}
            setKaufzeitpunktDisplay={setKaufzeitpunktDisplay}
            commitKaufzeitpunktDisplay={commitKaufzeitpunktDisplay}
          />
          <div className="new-trade-actions">
            <button className="primary" type="button" onClick={onSaveNewTrade} disabled={!canSaveTrade}>
              {editingTradeId ? t(language, "saveChanges") : t(language, "save")}
            </button>
            <button className="secondary" type="button" onClick={onCancelNewTradeView}>
              {t(language, "cancel")}
            </button>
          </div>
        </>
      ) : (
        <>
      <div className="new-trade-grid">
        <div className="card form-card card-span-2">
          <div className="card-title-row">
            <h3>{t(language, "basics")}</h3>
            <Tags size={20} className="card-title-icon" />
          </div>
          <div className="form-grid">
            <label>
              <span className="field-title">{t(language, "nameRequired")}</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t(language, "placeholderName")}
              />
            </label>
            <label>
              <span className="field-title">{t(language, "typeRequired")}</span>
              <select value={form.typ} onChange={(e) => setForm((prev) => ({ ...prev, typ: e.target.value as TradeFormType }))}>
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
              <span className="field-title">{t(language, "source")}</span>
              <select
                value={form.sourceBroker}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    sourceBroker: e.target.value as NonNullable<Trade["sourceBroker"]>
                  }))
                }
              >
                <option value="MANUAL">Manuell</option>
                <option value="TRADE_REPUBLIC">Trade Republic</option>
                <option value="N26">N26</option>
                <option value="BAWAG">BAWAG</option>
              </select>
            </label>
            {!isNoBasiswertType && (
              <label>
                <span className="field-title">{t(language, "basiswertRequired")}</span>
                <input
                  value={form.basiswert}
                  onChange={(e) => setForm((prev) => ({ ...prev, basiswert: e.target.value }))}
                  placeholder={t(language, "placeholderBasiswert")}
                />
              </label>
            )}
            <label>
              <span className="field-title">{t(language, "isinInputLabel")}</span>
              <input
                value={form.isin}
                onChange={(e) => setForm((prev) => ({ ...prev, isin: e.target.value.toUpperCase() }))}
                placeholder={t(language, "isinInputPlaceholder")}
              />
            </label>
            <label>
              <span className="field-title">{t(language, "wknInputLabel")}</span>
              <input
                value={form.wkn}
                onChange={(e) => setForm((prev) => ({ ...prev, wkn: e.target.value.toUpperCase() }))}
                placeholder={t(language, "wknInputPlaceholder")}
              />
            </label>
            <label>
              <span className="field-title">{t(language, "statusAuto")}</span>
              <input value={statusClosed ? t(language, "closed") : t(language, "open")} disabled />
            </label>
          </div>
        </div>

        <div className="card form-card notes-card new-trade-notes-card card-span-1">
          <div className="card-title-row">
            <h3>{t(language, "notes")}</h3>
            <FileText size={20} className="card-title-icon" />
          </div>
          <label className="notes-label">
            <span className="field-title">{t(language, "notesField")}</span>
            <textarea
              value={form.notiz}
              onChange={(e) => setForm((prev) => ({ ...prev, notiz: e.target.value }))}
              placeholder={t(language, "notesPlaceholder")}
            />
          </label>
        </div>

        {showBookingEditor && bookingDraft.length > 0 && (
          <div className="card form-card card-span-3 trade-cloud-bookings-card">
            <div className="card-title-row">
              <h3>{t(language, "cloudBookingsTitle")}</h3>
              <Layers size={20} className="card-title-icon" />
            </div>
            <p className="muted trade-cloud-bookings-hint">{t(language, "cloudBookingsHint")}</p>
            <div className="journal-week-table-wrap">
              <table className="journal-week-table trade-cloud-bookings-table">
                <thead>
                  <tr>
                    <th>{t(language, "booking")}</th>
                    <th>{t(language, "dateTime")}</th>
                    {!isTaxCorrectionType && <th>{t(language, "shares")}</th>}
                    {!isTaxCorrectionType && <th>{t(language, "cloudBookingsColUnit")}</th>}
                    {!isTaxCorrectionType && <th>{t(language, "cloudBookingsColGross")}</th>}
                    {!isTaxCorrectionType && <th>{t(language, "cloudBookingsColFees")}</th>}
                    <th>{t(language, "taxEur")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bookingDraft.map((b, idx) => {
                    const buyCount = bookingDraft.filter((r) => r.kind === "BUY").length;
                    const sellCount = bookingDraft.filter((r) => r.kind === "SELL").length;
                    const taxCount = bookingDraft.filter((r) => r.kind === "TAX_CORRECTION").length;
                    const incomeCount = bookingDraft.filter((r) => r.kind === "INCOME").length;
                    const canRemove =
                      (b.kind === "BUY" && buyCount > 1) ||
                      (b.kind === "SELL" && (!statusClosed || sellCount > 1)) ||
                      (b.kind === "TAX_CORRECTION" && taxCount > 1) ||
                      (b.kind === "INCOME" && incomeCount > 1);
                    const rowKey = b.transactionId || `${b.legacyLeg ?? b.kind}-${idx}`;
                    return (
                      <tr key={rowKey}>
                        <td>{bookingKindLabel(language, b.kind)}</td>
                        <td>
                          <div className="date-input-row booking-dt-row">
                            <input
                              type="text"
                              className="booking-datetime-input"
                              value={b.bookedAtDisplay?.trim() ? b.bookedAtDisplay : b.bookedAtIso ? formatDateTimeAT(b.bookedAtIso) : ""}
                              onChange={(e) =>
                                updateBookingDraftSorted(
                                  bookingDraft.map((row, i) =>
                                    i === idx ? { ...row, bookedAtDisplay: e.target.value } : row
                                  )
                                )
                              }
                              onBlur={(e) => {
                                const raw = e.target.value.trim();
                                updateBookingDraftSorted(
                                  bookingDraft.map((row, i) => {
                                    if (i !== idx) return row;
                                    if (!raw) {
                                      return {
                                        ...row,
                                        bookedAtDisplay: row.bookedAtIso ? formatDateTimeAT(row.bookedAtIso) || "" : ""
                                      };
                                    }
                                    const parsed = parseDateTimeDisplay(raw.replace(/\s+-\s+/g, " "));
                                    if (!parsed) {
                                      return {
                                        ...row,
                                        bookedAtDisplay: row.bookedAtIso ? formatDateTimeAT(row.bookedAtIso) || "" : ""
                                      };
                                    }
                                    const iso = new Date(parsed).toISOString();
                                    return {
                                      ...row,
                                      bookedAtIso: iso,
                                      bookedAtDisplay: formatDateTimeAT(iso) || raw
                                    };
                                  })
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder={t(language, "datePlaceholder")}
                            />
                            <button
                              type="button"
                              className="icon-btn"
                              title={t(language, "useNow")}
                              onClick={() => {
                                const nowValue = getNowLocalDateTimeValue();
                                const iso = new Date(nowValue).toISOString();
                                updateBookingDraftSorted(
                                  bookingDraft.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          bookedAtIso: iso,
                                          bookedAtDisplay: formatDateTimeAT(iso) || formatDateTimeDisplay(nowValue)
                                        }
                                      : row
                                  )
                                );
                              }}
                            >
                              <Clock3 size={14} />
                            </button>
                          </div>
                        </td>
                        {!isTaxCorrectionType && (
                          <>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="booking-num-input"
                                key={`qty-${rowKey}-${b.qty ?? ""}`}
                                defaultValue={b.qty !== undefined && Number.isFinite(b.qty) ? formatDecimalForForm(b.qty, numberLocale) : ""}
                                onBlur={(e) => {
                                  const parsed = parseLocaleDecimal(e.target.value, numberLocale);
                                  const qty = parsed !== null ? Math.max(0, parsed) : undefined;
                                  const unit = b.unitPrice ?? 0;
                                  const gross = qty !== undefined && Number.isFinite(unit) ? Math.round(qty * unit * 100) / 100 : 0;
                                  updateBookingDraftSorted(bookingDraft.map((row, i) => (i === idx ? { ...row, qty, grossAmount: gross } : row)));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="booking-num-input"
                                key={`unit-${rowKey}-${b.unitPrice ?? ""}`}
                                defaultValue={
                                  b.unitPrice !== undefined && Number.isFinite(b.unitPrice)
                                    ? formatDecimalForForm(b.unitPrice, numberLocale)
                                    : ""
                                }
                                onBlur={(e) => {
                                  const parsed = parseLocaleDecimal(e.target.value, numberLocale);
                                  const unitPrice = parsed !== null ? parsed : undefined;
                                  const qty = b.qty ?? 0;
                                  const gross =
                                    unitPrice !== undefined && Number.isFinite(qty)
                                      ? Math.round(qty * unitPrice * 100) / 100
                                      : 0;
                                  updateBookingDraftSorted(bookingDraft.map((row, i) => (i === idx ? { ...row, unitPrice, grossAmount: gross } : row)));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="booking-num-input"
                                key={`gross-${rowKey}-${b.grossAmount}`}
                                defaultValue={formatDecimalForForm(Number.isFinite(b.grossAmount) ? b.grossAmount : 0, numberLocale)}
                                onBlur={(e) => {
                                  const parsed = parseLocaleDecimal(e.target.value, numberLocale);
                                  updateBookingDraftSorted(bookingDraft.map((row, i) => (i === idx ? { ...row, grossAmount: parsed ?? 0 } : row)));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                title={t(language, "cloudBookingsGrossHint")}
                                aria-label={t(language, "cloudBookingsGrossHint")}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="booking-num-input"
                                key={`fees-${rowKey}-${b.feesAmount}`}
                                defaultValue={formatDecimalForForm(Number.isFinite(b.feesAmount) ? b.feesAmount : 0, numberLocale)}
                                onBlur={(e) => {
                                  const parsed = parseLocaleDecimal(e.target.value, numberLocale);
                                  updateBookingDraftSorted(bookingDraft.map((row, i) => (i === idx ? { ...row, feesAmount: parsed ?? 0 } : row)));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </td>
                          </>
                        )}
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="booking-num-input"
                            autoComplete="off"
                            value={
                              bookingTaxFocus?.idx === idx
                                ? bookingTaxFocus.draft
                                : formatDecimalForForm(Number.isFinite(b.taxAmount) ? b.taxAmount : 0, numberLocale)
                            }
                            onFocus={() =>
                              setBookingTaxFocus({
                                idx,
                                draft: formatDecimalForForm(Number.isFinite(b.taxAmount) ? b.taxAmount : 0, numberLocale)
                              })
                            }
                            onChange={(e) => setBookingTaxFocus({ idx, draft: e.target.value })}
                            onBlur={(e) => {
                              const raw = e.target.value;
                              const trimmed = raw.trim();
                              let nextTax = trimmed === "" ? 0 : (parseLocaleDecimal(raw, numberLocale) ?? 0);
                              if (!Number.isFinite(nextTax)) nextTax = 0;
                              if (b.kind !== "TAX_CORRECTION" && nextTax < 0) nextTax = 0;
                              updateBookingDraftSorted(
                                bookingDraft.map((row, i) => (i === idx ? { ...row, taxAmount: nextTax } : row))
                              );
                              setBookingTaxFocus(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary slim"
                            disabled={!canRemove}
                            onClick={() => updateBookingDraftSorted(bookingDraft.filter((_, i) => i !== idx))}
                          >
                            {t(language, "cloudBookingsRemove")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="trade-cloud-bookings-actions">
              {isTaxCorrectionType ? (
                <button
                  type="button"
                  className="secondary slim"
                  onClick={() => updateBookingDraftSorted([...bookingDraft, emptyBookingRow("TAX_CORRECTION")])}
                >
                  {t(language, "cloudBookingsAddTax")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="secondary slim"
                    onClick={() => updateBookingDraftSorted([...bookingDraft, emptyBookingRow("BUY")])}
                  >
                    {t(language, "cloudBookingsAddBuy")}
                  </button>
                  <button
                    type="button"
                    className="secondary slim"
                    onClick={() => updateBookingDraftSorted([...bookingDraft, emptyBookingRow("SELL")])}
                  >
                    {t(language, "cloudBookingsAddSell")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!isCashflowBookingType && (
          <div className="card form-card card-span-1 calc-card">
          <div className="card-title-row">
            <h3>{t(language, "buyData")}</h3>
            <Landmark size={20} className="card-title-icon" />
          </div>
          <div className="form-grid trade-row-grid">
            <label className="field-span-full">
              <span className="field-title">{t(language, buyTimeLabelKey)}</span>
              <div className="date-input-row">
                <input
                  type="text"
                  value={kaufzeitpunktDisplay}
                  onChange={(e) => setKaufzeitpunktDisplay(e.target.value)}
                  onBlur={commitKaufzeitpunktDisplay}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitKaufzeitpunktDisplay();
                    }
                  }}
                  placeholder={t(language, "datePlaceholder")}
                />
                <button
                  type="button"
                  className="icon-btn"
                  title={t(language, "useNow")}
                  onClick={() => {
                    const nowValue = getNowLocalDateTimeValue();
                    setForm((prev) => ({ ...prev, kaufzeitpunkt: nowValue }));
                    setKaufzeitpunktDisplay(formatDateTimeDisplay(nowValue));
                  }}
                >
                  <Clock3 size={14} />
                </button>
              </div>
            </label>
            <label className="field-span-full">
              <span className="field-title">{t(language, "txQtyPrice")}</span>
              <div className="formula-row">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.stueck}
                  onChange={(e) => handleStueckChange(normalizeDecimalInput(e.target.value))}
                  placeholder={t(language, "qty")}
                />
                <span className="formula-operator">x</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.kaufStueckpreis}
                  onChange={(e) => setForm((prev) => ({ ...prev, kaufStueckpreis: normalizeDecimalInput(e.target.value), kaufTransaktionManuell: "" }))}
                  placeholder={t(language, "unitPrice")}
                />
                <span className="formula-operator">=</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.kaufTransaktionManuell !== "" ? form.kaufTransaktionManuell : kaufTransaktionValue > 0 ? kaufTransaktionValue.toFixed(2) : ""}
                  onChange={(e) =>
                    setForm((prev) => {
                      const manual = normalizeDecimalInput(e.target.value);
                      const qty = Number.parseFloat(prev.stueck) || 0;
                      const manualValue = Number.parseFloat(manual);
                      return {
                        ...prev,
                        kaufTransaktionManuell: manual,
                        kaufStueckpreis: manual.trim() !== "" && Number.isFinite(manualValue) && qty > 0 ? (manualValue / qty).toFixed(6) : prev.kaufStueckpreis
                      };
                    })
                  }
                  placeholder={kaufTransaktionValue > 0 ? kaufTransaktionValue.toFixed(2) : "0,00"}
                />
              </div>
            </label>
            <label className="field-span-full calc-right-row">
              <span className="field-title">{t(language, "feesBuy")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.kaufGebuehren}
                onChange={(e) => setForm((prev) => ({ ...prev, kaufGebuehren: normalizeDecimalInput(e.target.value) }))}
                placeholder="0,00"
              />
            </label>
            <div className="field-spacer field-span-full" aria-hidden="true" />
          </div>
          <div className="calc-footer">
            <div className="calc-separator" aria-hidden="true" />
            <label className="calc-right-row">
              <span className="field-title">{t(language, "buyPriceEur")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.kaufPreisManuell !== "" ? form.kaufPreisManuell : kaufPreisCalculated > 0 ? kaufPreisCalculated.toFixed(2) : ""}
                onChange={(e) => setForm((prev) => ({ ...prev, kaufPreisManuell: normalizeDecimalInput(e.target.value) }))}
                placeholder={kaufPreisCalculated > 0 ? kaufPreisCalculated.toFixed(2) : "0,00"}
              />
            </label>
          </div>
          </div>
        )}

        {!isTaxCorrectionType && !isIncomeType && <div className="card form-card card-span-1 calc-card">
          <div className="card-title-row">
            <h3>{t(language, "sellData")}</h3>
            <ChartCandlestick size={20} className="card-title-icon" />
          </div>
          <div className="form-grid trade-row-grid">
            <label className="field-span-full">
              <span className="field-title">{t(language, "status")}</span>
              <select
                value={form.tradeStatus}
                onChange={(e) => {
                  const v = e.target.value as Trade["status"];
                  if (v === "Offen") {
                    setForm((prev) => ({ ...prev, tradeStatus: "Offen", verkaufszeitpunkt: "" }));
                    setVerkaufszeitpunktDisplay("");
                    updateBookingDraftSorted(bookingDraft.filter((row) => row.kind !== "SELL"));
                  } else {
                    setForm((prev) => ({ ...prev, tradeStatus: "Geschlossen" }));
                  }
                }}
              >
                <option value="Offen">{t(language, "open")}</option>
                <option value="Geschlossen">{t(language, "closed")}</option>
              </select>
            </label>
            <fieldset disabled={form.tradeStatus === "Offen"} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
            <label className="field-span-full">
              <span className="field-title">{t(language, "sellTime")}</span>
              <div className="date-input-row">
                <input
                  type="text"
                  value={verkaufszeitpunktDisplay}
                  onChange={(e) => setVerkaufszeitpunktDisplay(e.target.value)}
                  onBlur={commitVerkaufszeitpunktDisplay}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitVerkaufszeitpunktDisplay();
                    }
                  }}
                  placeholder={t(language, "datePlaceholder")}
                />
                <button
                  type="button"
                  className="icon-btn"
                  title={t(language, "useNow")}
                  onClick={() => {
                    const nowValue = getNowLocalDateTimeValue();
                    setForm((prev) => ({ ...prev, verkaufszeitpunkt: nowValue, tradeStatus: "Geschlossen" }));
                    setVerkaufszeitpunktDisplay(formatDateTimeDisplay(nowValue));
                  }}
                >
                  <Clock3 size={14} />
                </button>
              </div>
            </label>
            <label className="field-span-full">
              <span className="field-title">{t(language, "txQtyPrice")}</span>
              <div className="formula-row">
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    showBookingEditor
                      ? form.stueckVerkauf
                      : form.stueckVerkauf.trim() !== ""
                        ? form.stueckVerkauf
                        : form.stueck
                  }
                  readOnly={showBookingEditor}
                  title={showBookingEditor ? t(language, "sellQtyFromBookingsHint") : undefined}
                  onChange={(e) => handleVerkaufStueckChange(normalizeDecimalInput(e.target.value))}
                  placeholder={t(language, "qty")}
                />
                <span className="formula-operator">x</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.verkaufStueckpreis}
                  onChange={(e) => setForm((prev) => ({ ...prev, verkaufStueckpreis: normalizeDecimalInput(e.target.value), verkaufTransaktionManuell: "" }))}
                  placeholder={t(language, "unitPrice")}
                />
                <span className="formula-operator">=</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.verkaufTransaktionManuell !== "" ? form.verkaufTransaktionManuell : verkaufTransaktionValue > 0 ? verkaufTransaktionValue.toFixed(2) : ""}
                  onChange={(e) =>
                    setForm((prev) => {
                      const manual = normalizeDecimalInput(e.target.value);
                      const qty = Number.parseFloat(prev.stueckVerkauf.trim() !== "" ? prev.stueckVerkauf : prev.stueck) || 0;
                      const manualValue = Number.parseFloat(manual);
                      return {
                        ...prev,
                        verkaufTransaktionManuell: manual,
                        verkaufStueckpreis: manual.trim() !== "" && Number.isFinite(manualValue) && qty > 0 ? (manualValue / qty).toFixed(6) : prev.verkaufStueckpreis
                      };
                    })
                  }
                  placeholder={verkaufTransaktionValue > 0 ? verkaufTransaktionValue.toFixed(2) : "0,00"}
                />
              </div>
            </label>
            <label className="field-span-full calc-right-row">
              <span className="field-title">{t(language, "feesSell")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.verkaufGebuehren}
                onChange={(e) => setForm((prev) => ({ ...prev, verkaufGebuehren: normalizeDecimalInput(e.target.value) }))}
                placeholder="0,00"
              />
            </label>
            <div className="field-spacer field-span-full" aria-hidden="true" />
            </fieldset>
          </div>
          <div className="calc-footer">
            <fieldset disabled={form.tradeStatus === "Offen"} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
              <div className="calc-separator" aria-hidden="true" />
              <label className="calc-right-row">
                <span className="field-title">{t(language, "sellProceedsEur")}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.verkaufPreisManuell !== "" ? form.verkaufPreisManuell : verkaufStueckCount > 0 && verkaufStueckpreisValue > 0 ? verkaufserloesCalculated.toFixed(2) : ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, verkaufPreisManuell: normalizeDecimalInput(e.target.value) }))}
                  placeholder={verkaufStueckCount > 0 && verkaufStueckpreisValue > 0 ? verkaufserloesCalculated.toFixed(2) : "0,00"}
                />
              </label>
            </fieldset>
          </div>
        </div>}

        <div
          className={`card form-card card-span-1 result-card ${gewinn > 0 ? "is-win" : gewinn < 0 ? "is-loss" : "is-neutral"}`}
          style={{ "--result-tint-strength": `${resultTintStrength}` } as React.CSSProperties}
        >
          <div className="card-title-row">
            <h3>{t(language, "result")}</h3>
            <HandCoins size={20} className="card-title-icon" />
            <button type="button" className="secondary slim" onClick={handleRecalculateResult} style={{ marginLeft: "auto" }}>
              {t(language, "reset")}
            </button>
          </div>
          <div className="form-grid">
            <>
              <label className="field-span-full calc-right-row">
                {renderResultLabel(t(language, "differenceEur"), "Differenz = Verkaufserlös vor Steuer - Kaufpreis.")}
                <input
                  type="number"
                  step="0.01"
                  value={Number.isFinite(differenz) ? differenz.toFixed(2) : ""}
                  onChange={(e) => handleDifferenzInput(e.target.value)}
                  placeholder="0,00"
                />
              </label>
              <label className="field-span-full calc-right-row">
                {renderResultLabel(t(language, "taxEur"), "Steuer = manuelle Eingabe oder automatische Berechnung aus (Verkaufstransaktion - Kauftransaktion) × Steuersatz.")}
                <input
                  type="number"
                  step="0.01"
                  value={form.verkaufSteuern}
                  onChange={(e) => setForm((prev) => ({ ...prev, verkaufSteuern: e.target.value }))}
                  placeholder={verkaufTransaktionValue > 0 ? money(steuerpflichtigerGewinnValue * 0.275) : "0,00"}
                />
              </label>
              <div className="calc-separator field-span-full" aria-hidden="true" />
              <label className="field-span-full calc-right-row">
                {renderResultLabel(t(language, "profitEur"), "Gewinn = Differenz + Steuer.")}
                <input
                  type="number"
                  step="0.01"
                  value={Number.isFinite(gewinn) ? gewinn.toFixed(2) : ""}
                  onChange={(e) => handleGewinnInput(e.target.value)}
                  placeholder="0,00"
                />
              </label>
              <label className="field-span-full calc-right-row">
                {renderResultLabel(t(language, "returnPct"), "Rendite (%) = Gewinn / Kaufpreis × 100.")}
                <input
                  type="number"
                  step="0.01"
                  value={Number.isFinite(rendite) ? rendite.toFixed(2) : ""}
                  onChange={(e) => handleRenditeInput(e.target.value)}
                  placeholder="0,00"
                />
              </label>
            </>
          </div>
        </div>

        {showLiveChartCard && (
          <div className="card form-card card-span-2 new-trade-live-chart-wide">
            <div className="card-title-row">
              <h3>
                <Activity size={18} aria-hidden style={{ verticalAlign: "middle", marginRight: 6 }} />
                {derivativeLiveQueriesChart ? t(language, "liveChartUnderlyingTitle") : t(language, "liveChart")}
              </h3>
            </div>
            {derivativeLiveQueriesChart ? (
              <div className="new-trade-derivative-underlying-wrap new-trade-derivative-underlying-chart-only">
                <p className="live-chart-hint live-chart-hint-compact">{t(language, "liveChartUnderlyingDerivativeHint")}</p>
                {basisChartTvSymbol ? (
                  <>
                    <p className="live-chart-hint live-chart-hint-compact">
                      {t(language, "liveChartPreview")} <code>{canonicalizeBasiswert(form.basiswert.trim())}</code> — <code>{basisChartTvSymbol}</code>
                    </p>
                    <TradingViewLiveChart symbol={basisChartTvSymbol} theme={chartTheme} height={liveChartEmbedHeight} />
                  </>
                ) : (
                  <p className="live-chart-empty">{t(language, "enterBasiswertHint")}</p>
                )}
              </div>
            ) : (
              <div className="new-trade-live-charts-grid new-trade-live-charts-grid--narrow">
                <div className="new-trade-live-chart-col">
                  <h4 className="live-chart-title">{t(language, "liveChartIsin")}</h4>
                  {isValidIsin && isinLookupState === "loading" && <p className="live-chart-hint live-chart-hint-compact">{t(language, "editAssetSearching")}</p>}
                  {isinLookupState === "error" && <p className="live-chart-empty">{t(language, "isinLookupError")}</p>}
                  {!isValidIsin && normalizedIsin.length > 0 && <p className="live-chart-empty">{t(language, "isinInvalidHint")}</p>}
                  {isValidIsin && isinLookupState === "empty" && <p className="live-chart-empty">{t(language, "isinNoResults")}</p>}
                  {isValidIsin && isinLiveSymbol && (
                    <TradingViewLiveChart symbol={isinLiveSymbol} theme={chartTheme} height={liveChartEmbedHeight} />
                  )}
                </div>
                <div className="new-trade-live-chart-col">
                  <h4 className="live-chart-title">{t(language, "liveChartBasis")}</h4>
                  {!basiswertLiveTvSymbol && isValidIsin && isinLookupState === "loading" && (
                    <p className="live-chart-hint live-chart-hint-compact">{t(language, "liveChartBasisWaitingIsin")}</p>
                  )}
                  {basisChartTvSymbol ? (
                    <>
                      <p className="live-chart-hint live-chart-hint-compact">
                        {basisChartUsesIsinFallback ? (
                          t(language, "liveChartBasisFromIsin", { isin: normalizedIsin, symbol: basisChartTvSymbol })
                        ) : (
                          <>
                            {t(language, "liveChartPreview")} <code>{canonicalizeBasiswert(form.basiswert.trim())}</code> — <code>{basisChartTvSymbol}</code>
                          </>
                        )}
                      </p>
                      <TradingViewLiveChart symbol={basisChartTvSymbol} theme={chartTheme} height={liveChartEmbedHeight} />
                    </>
                  ) : (
                    !(isValidIsin && isinLookupState === "loading") && (
                      <p className="live-chart-empty">{t(language, "enterBasiswertHint")}</p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {derivativeLiveQueriesChart && (
          <div
            className={`card form-card new-trade-derivative-kurs-suche-row ${showLiveChartCard ? "card-span-1" : "card-span-3"}`}
          >
            <div className="card-title-row">
              <h3>
                <Search size={18} aria-hidden style={{ verticalAlign: "middle", marginRight: 6 }} />
                {t(language, "liveChartDerivativeTitle")}
              </h3>
            </div>
            <div className="new-trade-derivative-live-block">
              <p className="live-chart-hint">{t(language, "newTradeDerivativeLiveHint")}</p>
              {derivativeFinanceQuery ? (
                <>
                  <p className="live-chart-hint live-chart-hint-compact new-trade-derivative-live-query">
                    {t(language, "newTradeDerivativeLiveQuery", { q: derivativeFinanceQuery })}
                  </p>
                  <a
                    className="secondary new-trade-derivative-finance-link"
                    href={buildFinanceSearchUrl(derivativeFinanceQuery, financeService)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden />
                    {t(language, "financeOpen", { svc: financeProviderLabel(language, financeService) })}
                  </a>
                </>
              ) : (
                <p className="live-chart-empty">{t(language, "newTradeDerivativeLiveNeedQuery")}</p>
              )}
            </div>
          </div>
        )}

        {!isNoBasiswertType && <div className="card form-card asset-history-card card-span-1">
          <div className="asset-history-title-row">
            <h3>
              {t(language, "assetHistory")}
            </h3>
            <TrendingUp size={20} className="card-title-icon" />
          </div>
          <div className="asset-history-subtitle">
            <span>{basiswertStats?.basiswertLabel || t(language, "pickBasiswert")}</span>
          </div>

          {!basiswertStats ? (
            <p className="asset-history-empty">{t(language, "enterBasiswertHint")}</p>
          ) : (
            <>
              <div className="asset-history-kpis">
                <div>
                  <small>{t(language, "tradesCountSmall")}</small>
                  <strong>{basiswertStats.totalTrades}</strong>
                </div>
                <div>
                  <small>{t(language, "closed")}</small>
                  <strong>{basiswertStats.closedTrades}</strong>
                </div>
                <div>
                  <small>{t(language, "open")}</small>
                  <strong>{basiswertStats.offeneTrades}</strong>
                </div>
                <div>
                  <small>{t(language, "hitRate")}</small>
                  <strong>{basiswertStats.winRate.toFixed(1)}%</strong>
                </div>
                <div>
                  <small>{t(language, "avgPL")}</small>
                  <strong className={basiswertStats.avgPL >= 0 ? "positive" : "negative"}>{money(basiswertStats.avgPL)}</strong>
                </div>
                <div>
                  <small>{t(language, "totalPLSmall")}</small>
                  <strong className={basiswertStats.totalPL >= 0 ? "positive" : "negative"}>{money(basiswertStats.totalPL)}</strong>
                </div>
              </div>

              <div className="asset-history-chart-block">
                <h4>
                  <BarChart3 size={13} />
                  {t(language, "runningPLChart")}
                </h4>
                {renderMiniBars(basiswertStats.perfSeries, "pl")}
              </div>

              <div className="asset-history-chart-block">
                <h4>
                  <BarChart3 size={13} />
                  {t(language, "monthlyPL6")}
                </h4>
                {renderMiniBars(basiswertStats.monthlySeries, "pl")}
              </div>
            </>
          )}
        </div>}

        {!isNoBasiswertType && <div className="card form-card card-span-1">
          <div className="card-title-row">
            <h3>{t(language, "priceScenario")}</h3>
            <Activity size={20} className="card-title-icon" />
          </div>
          <p className="asset-history-empty">
            {t(language, "priceScenarioHint")}
            {Number.parseFloat(form.stueck) > 0 ? t(language, "withPieces", { n: form.stueck }) : t(language, "perUnit")}
          </p>
          {preisSzenario.length === 0 ? (
            <p className="asset-history-empty">{t(language, "enterBuyFirst")}</p>
          ) : (
            <div className="asset-history-chart-block">
              <h4>
                <BarChart3 size={13} />
                {t(language, "changeVsBuy")}
              </h4>
              {renderMiniBars(preisSzenario, "pl")}
            </div>
          )}
        </div>}
      </div>

      <div className="new-trade-actions">
        <button className="primary" type="button" onClick={onSaveNewTrade} disabled={!canSaveTrade}>
          {editingTradeId ? t(language, "saveChanges") : t(language, "save")}
        </button>
        <button className="secondary" type="button" onClick={onCancelNewTradeView}>
          {t(language, "cancel")}
        </button>
      </div>
        </>
      )}
    </section>
  );
}
