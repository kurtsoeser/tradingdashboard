import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CandlestickChart, ChartCandlestick, Clock3, FileText, HandCoins, Landmark, Tags, TrendingUp } from "lucide-react";
import { formatMonthLabel, getNowLocalDateTimeValue, parseStoredDateTime } from "../../app/date";
import { t } from "../../app/i18n";
import type { AssetDisplayRow, AssetMeta, NewTradeForm, TradeFormType } from "../../app/types";
import { getTradeRealizedPL, isTradeClosed, money } from "../../lib/analytics";
import { canonicalizeBasiswert, sameBasiswertBucket } from "../../lib/basiswertCanonical";
import { lookupKnownTickerSuggestion } from "../../data/knownAssetTickers";
import { assetToTradingViewSymbol } from "../../lib/tradingViewSymbol";
import { searchByIsinOpenFigi } from "../../lib/openFigiSearch";
import { resolvePlainTickerForTradingView } from "../../data/tickerTradingViewAliases";
import type { AppSettings } from "../../app/settings";
import type { Trade } from "../../types/trade";
import { PageHeader } from "../PageHeader";
import { TradingViewLiveChart } from "../TradingViewLiveChart";

interface NewTradeViewProps {
  editingTradeId: string | null;
  language: AppSettings["language"];
  trades: Trade[];
  assetMeta: AssetMeta[];
  chartTheme: "dark" | "light";
  form: NewTradeForm;
  setForm: React.Dispatch<React.SetStateAction<NewTradeForm>>;
  statusClosed: boolean;
  gewinn: number;
  rendite: number;
  haltedauer: number;
  onSaveNewTrade: () => void;
  onSetViewTrades: () => void;
  onResetForm: () => void;
  onCancelEdit: () => void;
}

export function NewTradeView({
  editingTradeId,
  language,
  trades,
  assetMeta,
  chartTheme,
  form,
  setForm,
  statusClosed,
  gewinn,
  rendite,
  haltedauer,
  onSaveNewTrade,
  onSetViewTrades,
  onResetForm,
  onCancelEdit
}: NewTradeViewProps) {
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

  const normalizedIsin = form.isin.trim().toUpperCase();
  const isValidIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalizedIsin);

  useEffect(() => {
    setKaufzeitpunktDisplay(formatDateTimeDisplay(form.kaufzeitpunkt));
  }, [form.kaufzeitpunkt]);

  useEffect(() => {
    setVerkaufszeitpunktDisplay(formatDateTimeDisplay(form.verkaufszeitpunkt));
  }, [form.verkaufszeitpunkt]);

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
    setForm((prev) => ({ ...prev, verkaufszeitpunkt: parsed }));
    setVerkaufszeitpunktDisplay(formatDateTimeDisplay(parsed));
  };

  const resultTintStrength = Math.min(Math.abs(rendite), 30) / 30;
  const stueckValue = Number.parseFloat(form.stueck) || 0;
  const kaufStueckpreisValue = Number.parseFloat(form.kaufStueckpreis) || 0;
  const kaufTransaktionManuellValue = Number.parseFloat(form.kaufTransaktionManuell);
  const kaufGebuehrenValue = Number.parseFloat(form.kaufGebuehren) || 0;
  const verkaufStueckpreisValue = Number.parseFloat(form.verkaufStueckpreis) || 0;
  const verkaufTransaktionManuellValue = Number.parseFloat(form.verkaufTransaktionManuell);
  const kaufTransaktionValue =
    form.kaufTransaktionManuell.trim() !== "" && Number.isFinite(kaufTransaktionManuellValue) ? kaufTransaktionManuellValue : stueckValue > 0 ? stueckValue * kaufStueckpreisValue : 0;
  const verkaufTransaktionValue =
    form.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(verkaufTransaktionManuellValue) ? verkaufTransaktionManuellValue : stueckValue > 0 ? stueckValue * verkaufStueckpreisValue : 0;
  const verkaufSteuernValue = form.verkaufSteuern.trim() === "" ? verkaufTransaktionValue * 0.275 : Number.parseFloat(form.verkaufSteuern) || 0;
  const verkaufGebuehrenValue = Number.parseFloat(form.verkaufGebuehren) || 0;
  const kaufPreisCalculated = stueckValue > 0 ? kaufTransaktionValue + kaufGebuehrenValue : 0;
  const kaufPreisManuellValue = Number.parseFloat(form.kaufPreisManuell);
  const kaufPreisEffektiv =
    form.kaufPreisManuell.trim() !== "" && Number.isFinite(kaufPreisManuellValue) ? kaufPreisManuellValue : kaufPreisCalculated;
  const verkaufserloesCalculated = stueckValue > 0 ? verkaufTransaktionValue - verkaufSteuernValue - verkaufGebuehrenValue : 0;
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
    const tickerKnown = lookupKnownTickerSuggestion(canon)?.ticker?.trim();
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
        const symbol = first?.ticker ? resolvePlainTickerForTradingView(first.ticker) : null;
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

  const handleStueckChange = (nextStueck: string) => {
    setForm((prev) => {
      const qty = Number.parseFloat(nextStueck) || 0;
      const next: NewTradeForm = { ...prev, stueck: nextStueck };
      const buyTxManual = Number.parseFloat(prev.kaufTransaktionManuell);
      if (prev.kaufTransaktionManuell.trim() !== "" && Number.isFinite(buyTxManual) && qty > 0) {
        next.kaufStueckpreis = (buyTxManual / qty).toFixed(6);
      }
      const sellTxManual = Number.parseFloat(prev.verkaufTransaktionManuell);
      if (prev.verkaufTransaktionManuell.trim() !== "" && Number.isFinite(sellTxManual) && qty > 0) {
        next.verkaufStueckpreis = (sellTxManual / qty).toFixed(6);
      }
      return next;
    });
  };

  return (
    <section className="section new-trade">
      <PageHeader
        title={editingTradeId ? t(language, "editTradeTitle") : t(language, "newTradeTitle")}
        subtitle={editingTradeId ? t(language, "editTradeSubtitle") : t(language, "newTradeSubtitle")}
        actions={
          <button className="secondary" onClick={onSetViewTrades}>
            <CandlestickChart size={14} />
            {t(language, "toTrades")}
          </button>
        }
      />

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
              <span className="field-title">{t(language, "basiswertRequired")}</span>
              <input
                value={form.basiswert}
                onChange={(e) => setForm((prev) => ({ ...prev, basiswert: e.target.value }))}
                placeholder={t(language, "placeholderBasiswert")}
              />
            </label>
            <label>
              <span className="field-title">{t(language, "isinInputLabel")}</span>
              <input
                value={form.isin}
                onChange={(e) => setForm((prev) => ({ ...prev, isin: e.target.value.toUpperCase() }))}
                placeholder={t(language, "isinInputPlaceholder")}
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

        {(form.isin.trim() || form.basiswert.trim()) && (
          <div className="card form-card card-span-3 new-trade-basis-chart-card">
            <div className="card-title-row">
              <h3>
                <Activity size={18} aria-hidden style={{ verticalAlign: "middle", marginRight: 6 }} />
                {t(language, "liveChart")}
              </h3>
            </div>
            <div className="new-trade-live-charts-grid">
              <div className="new-trade-live-chart-col">
                <h4 className="live-chart-title">{t(language, "liveChartIsin")}</h4>
                {isValidIsin && isinLookupState === "loading" && <p className="live-chart-hint live-chart-hint-compact">{t(language, "editAssetSearching")}</p>}
                {isinLookupState === "error" && <p className="live-chart-empty">{t(language, "isinLookupError")}</p>}
                {!isValidIsin && normalizedIsin.length > 0 && <p className="live-chart-empty">{t(language, "isinInvalidHint")}</p>}
                {isValidIsin && isinLookupState === "empty" && <p className="live-chart-empty">{t(language, "isinNoResults")}</p>}
                {isValidIsin && isinLiveSymbol && <TradingViewLiveChart symbol={isinLiveSymbol} theme={chartTheme} height={320} />}
              </div>
              <div className="new-trade-live-chart-col">
                <h4 className="live-chart-title">{t(language, "liveChartBasis")}</h4>
                {basiswertLiveTvSymbol ? (
                  <>
                    <p className="live-chart-hint live-chart-hint-compact">
                      {t(language, "liveChartPreview")} <code>{canonicalizeBasiswert(form.basiswert.trim())}</code> — <code>{basiswertLiveTvSymbol}</code>
                    </p>
                    <TradingViewLiveChart symbol={basiswertLiveTvSymbol} theme={chartTheme} height={320} />
                  </>
                ) : (
                  <p className="live-chart-empty">{t(language, "enterBasiswertHint")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card form-card card-span-1 calc-card">
          <div className="card-title-row">
            <h3>{t(language, "buyData")}</h3>
            <Landmark size={20} className="card-title-icon" />
          </div>
          <div className="form-grid trade-row-grid">
            <label className="field-span-full">
              <span className="field-title">{t(language, "buyTime")}</span>
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
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.stueck}
                  onChange={(e) => handleStueckChange(e.target.value)}
                  placeholder={t(language, "qty")}
                />
                <span className="formula-operator">x</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.kaufStueckpreis}
                  onChange={(e) => setForm((prev) => ({ ...prev, kaufStueckpreis: e.target.value, kaufTransaktionManuell: "" }))}
                  placeholder={t(language, "unitPrice")}
                />
                <span className="formula-operator">=</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.kaufTransaktionManuell !== "" ? form.kaufTransaktionManuell : kaufTransaktionValue > 0 ? kaufTransaktionValue.toFixed(2) : ""}
                  onChange={(e) =>
                    setForm((prev) => {
                      const manual = e.target.value;
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
                type="number"
                step="0.01"
                value={form.kaufGebuehren}
                onChange={(e) => setForm((prev) => ({ ...prev, kaufGebuehren: e.target.value }))}
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
                type="number"
                step="0.01"
                value={form.kaufPreisManuell !== "" ? form.kaufPreisManuell : kaufPreisCalculated > 0 ? kaufPreisCalculated.toFixed(2) : ""}
                onChange={(e) => setForm((prev) => ({ ...prev, kaufPreisManuell: e.target.value }))}
                placeholder={kaufPreisCalculated > 0 ? kaufPreisCalculated.toFixed(2) : "0,00"}
              />
            </label>
          </div>
        </div>

        <div className="card form-card card-span-1 calc-card">
          <div className="card-title-row">
            <h3>{t(language, "sellData")}</h3>
            <ChartCandlestick size={20} className="card-title-icon" />
          </div>
          <div className="form-grid trade-row-grid">
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
                    setForm((prev) => ({ ...prev, verkaufszeitpunkt: nowValue }));
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
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.stueck}
                  onChange={(e) => handleStueckChange(e.target.value)}
                  placeholder={t(language, "qty")}
                />
                <span className="formula-operator">x</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.verkaufStueckpreis}
                  onChange={(e) => setForm((prev) => ({ ...prev, verkaufStueckpreis: e.target.value, verkaufTransaktionManuell: "" }))}
                  placeholder={t(language, "unitPrice")}
                />
                <span className="formula-operator">=</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.verkaufTransaktionManuell !== "" ? form.verkaufTransaktionManuell : verkaufTransaktionValue > 0 ? verkaufTransaktionValue.toFixed(2) : ""}
                  onChange={(e) =>
                    setForm((prev) => {
                      const manual = e.target.value;
                      const qty = Number.parseFloat(prev.stueck) || 0;
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
                type="number"
                step="0.01"
                value={form.verkaufGebuehren}
                onChange={(e) => setForm((prev) => ({ ...prev, verkaufGebuehren: e.target.value }))}
                placeholder="0,00"
              />
            </label>
            <div className="field-spacer field-span-full" aria-hidden="true" />
            <label className="field-span-full calc-right-row tax-row">
              <span className="field-title">{t(language, "taxDefault")}</span>
              <input
                type="number"
                step="0.01"
                value={form.verkaufSteuern}
                onChange={(e) => setForm((prev) => ({ ...prev, verkaufSteuern: e.target.value }))}
                placeholder={verkaufTransaktionValue > 0 ? money(verkaufTransaktionValue * 0.275) : "0,00"}
              />
            </label>
          </div>
          <div className="calc-footer">
            <div className="calc-separator" aria-hidden="true" />
            <label className="calc-right-row">
              <span className="field-title">{t(language, "sellProceedsEur")}</span>
              <input
                type="number"
                step="0.01"
                value={form.verkaufPreisManuell !== "" ? form.verkaufPreisManuell : stueckValue > 0 && verkaufStueckpreisValue > 0 ? verkaufserloesCalculated.toFixed(2) : ""}
                onChange={(e) => setForm((prev) => ({ ...prev, verkaufPreisManuell: e.target.value }))}
                placeholder={stueckValue > 0 && verkaufStueckpreisValue > 0 ? verkaufserloesCalculated.toFixed(2) : "0,00"}
              />
            </label>
          </div>
        </div>

        <div
          className={`card form-card card-span-1 result-card ${gewinn > 0 ? "is-win" : gewinn < 0 ? "is-loss" : "is-neutral"}`}
          style={{ "--result-tint-strength": `${resultTintStrength}` } as React.CSSProperties}
        >
          <div className="card-title-row">
            <h3>{t(language, "result")}</h3>
            <HandCoins size={20} className="card-title-icon" />
          </div>
          <div className="form-grid">
            <label>
              <span className="field-title">{t(language, "profitEur")}</span>
              <input value={money(gewinn)} disabled />
            </label>
            <label>
              <span className="field-title">{t(language, "returnPct")}</span>
              <input value={`${rendite.toFixed(2)}%`} disabled />
            </label>
            <label>
              <span className="field-title">{t(language, "holdDays")}</span>
              <input value={`${haltedauer}`} disabled />
            </label>
          </div>
        </div>

        <div className="card form-card asset-history-card card-span-1">
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
        </div>

        <div className="card form-card card-span-1">
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
        </div>
      </div>

      <div className="new-trade-actions">
        <button className="primary" onClick={onSaveNewTrade}>
          {editingTradeId ? t(language, "saveChanges") : t(language, "save")}
        </button>
        <button
          className="secondary"
          onClick={() => {
            onResetForm();
            onCancelEdit();
          }}
        >
          {t(language, "cancel")}
        </button>
      </div>
    </section>
  );
}
