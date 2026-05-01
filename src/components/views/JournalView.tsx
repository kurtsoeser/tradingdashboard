import { BookMarked, CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "../../app/settings";
import { t } from "../../app/i18n";
import type { JournalData } from "../../lib/journalStorage";
import {
  addDaysLocal,
  getIsoWeekYearAndWeek,
  mondayOfIsoWeek,
  parseIsoWeekKey,
  parseLocalYmd,
  sundayOfIsoWeek,
  toIsoWeekKey,
  toLocalYmd
} from "../../lib/journalIsoWeek";
import { PageHeader } from "../PageHeader";
import { JournalMarkdownField } from "../JournalMarkdownField";
import { JournalDayTradesPanel } from "../JournalDayTradesPanel";
import { JournalMonthTradesPanel } from "../JournalMonthTradesPanel";
import { JournalAiReportPanel } from "../JournalAiReportPanel";
import { JournalWeekTradesPanel } from "../JournalWeekTradesPanel";
import type { Trade } from "../../types/trade";

const JOURNAL_AUTOSAVE_MS = 550;

interface JournalViewProps {
  language: AppSettings["language"];
  journalData: JournalData;
  trades: Trade[];
  onJournalDayChange: (ymd: string, text: string) => void;
  onJournalWeekChange: (weekKey: string, text: string) => void;
  onJournalMonthChange: (ym: string, text: string) => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}

export function JournalView({
  language,
  journalData,
  trades,
  onJournalDayChange,
  onJournalWeekChange,
  onJournalMonthChange,
  onEditTrade,
  onDeleteTrade
}: JournalViewProps) {
  const locale = language === "en" ? "en-US" : "de-AT";
  const [mode, setMode] = useState<"week" | "day" | "month">("week");
  const [weekKey, setWeekKey] = useState(() => toIsoWeekKey(new Date()));
  const [dayYmd, setDayYmd] = useState(() => toLocalYmd(new Date()));
  const [monthYm, setMonthYm] = useState(() => toLocalYmd(new Date()).slice(0, 7));
  const [draftWeek, setDraftWeek] = useState("");
  const [draftDay, setDraftDay] = useState("");
  const [draftMonth, setDraftMonth] = useState("");
  const [aiReportOpen, setAiReportOpen] = useState(false);

  const flushJournalDraftsRef = useRef({
    weekKey,
    dayYmd,
    monthYm,
    draftWeek,
    draftDay,
    draftMonth,
    journalData,
    onJournalWeekChange,
    onJournalDayChange,
    onJournalMonthChange
  });
  flushJournalDraftsRef.current = {
    weekKey,
    dayYmd,
    monthYm,
    draftWeek,
    draftDay,
    draftMonth,
    journalData,
    onJournalWeekChange,
    onJournalDayChange,
    onJournalMonthChange
  };

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      const c = flushJournalDraftsRef.current;
      const pw = c.journalData.byWeek[c.weekKey] ?? "";
      if (c.draftWeek !== pw) c.onJournalWeekChange(c.weekKey, c.draftWeek);
      const pd = c.journalData.byDay[c.dayYmd] ?? "";
      if (c.draftDay !== pd) c.onJournalDayChange(c.dayYmd, c.draftDay);
      const pm = c.journalData.byMonth[c.monthYm] ?? "";
      if (c.draftMonth !== pm) c.onJournalMonthChange(c.monthYm, c.draftMonth);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    setDraftWeek(journalData.byWeek[weekKey] ?? "");
  }, [weekKey, journalData.byWeek]);

  useEffect(() => {
    setDraftDay(journalData.byDay[dayYmd] ?? "");
  }, [dayYmd, journalData.byDay]);

  useEffect(() => {
    setDraftMonth(journalData.byMonth[monthYm] ?? "");
  }, [monthYm, journalData.byMonth]);

  const parsedWeek = parseIsoWeekKey(weekKey);
  const weekRangeLabel =
    parsedWeek !== null
      ? (() => {
          const mon = mondayOfIsoWeek(parsedWeek.isoYear, parsedWeek.week);
          const sun = sundayOfIsoWeek(parsedWeek.isoYear, parsedWeek.week);
          const a = mon.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
          const b = sun.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
          return `${a} – ${b}`;
        })()
      : "";

  const persistWeekIfChanged = () => {
    const prev = journalData.byWeek[weekKey] ?? "";
    if (draftWeek !== prev) onJournalWeekChange(weekKey, draftWeek);
  };

  const persistDayIfChanged = () => {
    const prev = journalData.byDay[dayYmd] ?? "";
    if (draftDay !== prev) onJournalDayChange(dayYmd, draftDay);
  };

  const persistMonthIfChanged = () => {
    const prev = journalData.byMonth[monthYm] ?? "";
    if (draftMonth !== prev) onJournalMonthChange(monthYm, draftMonth);
  };

  const setModeFlushing = (next: "week" | "day" | "month") => {
    if (mode === "week") persistWeekIfChanged();
    else if (mode === "day") persistDayIfChanged();
    else persistMonthIfChanged();
    setMode(next);
  };

  const journalWeekStored = journalData.byWeek[weekKey] ?? "";
  useEffect(() => {
    if (draftWeek === journalWeekStored) return;
    const id = window.setTimeout(() => {
      onJournalWeekChange(weekKey, draftWeek);
    }, JOURNAL_AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [draftWeek, weekKey, journalWeekStored, onJournalWeekChange]);

  const journalDayStored = journalData.byDay[dayYmd] ?? "";
  useEffect(() => {
    if (draftDay === journalDayStored) return;
    const id = window.setTimeout(() => {
      onJournalDayChange(dayYmd, draftDay);
    }, JOURNAL_AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [draftDay, dayYmd, journalDayStored, onJournalDayChange]);

  const journalMonthStored = journalData.byMonth[monthYm] ?? "";
  useEffect(() => {
    if (draftMonth === journalMonthStored) return;
    const id = window.setTimeout(() => {
      onJournalMonthChange(monthYm, draftMonth);
    }, JOURNAL_AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [draftMonth, monthYm, journalMonthStored, onJournalMonthChange]);

  const shiftWeek = (delta: number) => {
    persistWeekIfChanged();
    const p = parseIsoWeekKey(weekKey);
    if (!p) return;
    const mon = mondayOfIsoWeek(p.isoYear, p.week);
    const next = addDaysLocal(mon, delta * 7);
    setWeekKey(toIsoWeekKey(next));
  };

  const goThisWeek = () => {
    persistWeekIfChanged();
    setWeekKey(toIsoWeekKey(new Date()));
  };
  const goToday = () => {
    persistDayIfChanged();
    setDayYmd(toLocalYmd(new Date()));
  };

  const shiftDay = (delta: number) => {
    persistDayIfChanged();
    const d = parseLocalYmd(dayYmd);
    if (!d) return;
    setDayYmd(toLocalYmd(addDaysLocal(d, delta)));
  };

  const parseYmToDate = (ym: string): Date | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) return null;
    const d = new Date(year, month, 1);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const toYm = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const shiftMonth = (delta: number) => {
    persistMonthIfChanged();
    const d = parseYmToDate(monthYm);
    if (!d) return;
    setMonthYm(toYm(new Date(d.getFullYear(), d.getMonth() + delta, 1)));
  };
  const goCurrentMonth = () => {
    persistMonthIfChanged();
    setMonthYm(toYm(new Date()));
  };

  const dayParsed = parseLocalYmd(dayYmd);
  const dayHeading =
    dayParsed !== null
      ? dayParsed.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      : dayYmd;

  const weekMeta = dayParsed ? getIsoWeekYearAndWeek(dayParsed) : null;
  const dayWeekKey = weekMeta ? `${weekMeta.isoYear}-W${String(weekMeta.week).padStart(2, "0")}` : null;
  const showWeekJumpHint = Boolean(weekMeta && dayWeekKey && dayWeekKey !== weekKey);
  const monthDate = parseYmToDate(monthYm);
  const monthHeading =
    monthDate !== null
      ? monthDate.toLocaleDateString(locale, { month: "long", year: "numeric" })
      : monthYm;

  return (
    <section className="section journal-page">
      <PageHeader
        title={
          <>
            <BookMarked size={18} />
            {t(language, "journalTitle")}
          </>
        }
        subtitle={t(language, "journalSubtitle")}
      />

      <div className="analytics-tabbar journal-tabbar">
        <button type="button" className={mode === "month" ? "secondary active" : "secondary"} onClick={() => setModeFlushing("month")}>
          {t(language, "journalTabMonth")}
        </button>
        <button type="button" className={mode === "week" ? "secondary active" : "secondary"} onClick={() => setModeFlushing("week")}>
          {t(language, "journalTabWeek")}
        </button>
        <button type="button" className={mode === "day" ? "secondary active" : "secondary"} onClick={() => setModeFlushing("day")}>
          {t(language, "journalTabDay")}
        </button>
      </div>

      {mode === "week" && parsedWeek !== null && (
        <div className="analytics-tab-panel">
          <div className="card journal-card">
            <div className="journal-toolbar">
              <button type="button" className="secondary" onClick={() => shiftWeek(-1)} aria-label={t(language, "journalPrevWeek")}>
                <ChevronLeft size={18} />
              </button>
              <div className="journal-toolbar-center">
                <h3>
                  <CalendarDays size={14} />
                  {t(language, "journalWeekHeading", { week: parsedWeek.week, year: parsedWeek.isoYear })}
                </h3>
                <p className="journal-range-muted">{weekRangeLabel}</p>
              </div>
              <button type="button" className="secondary" onClick={() => shiftWeek(1)} aria-label={t(language, "journalNextWeek")}>
                <ChevronRight size={18} />
              </button>
            </div>
            <button type="button" className="secondary journal-today-btn" onClick={goThisWeek}>
              {t(language, "journalThisWeek")}
            </button>
            <JournalMarkdownField
              language={language}
              value={draftWeek}
              onChange={setDraftWeek}
              onBlur={persistWeekIfChanged}
              placeholder={t(language, "journalWeekPlaceholder")}
            />
            <p className="journal-hint">{t(language, "journalBlurHint")}</p>
            <JournalWeekTradesPanel
              language={language}
              trades={trades}
              isoYear={parsedWeek.isoYear}
              week={parsedWeek.week}
              onEditTrade={onEditTrade}
              onDeleteTrade={onDeleteTrade}
            />
          </div>
        </div>
      )}

      {mode === "day" && (
        <div className="analytics-tab-panel">
          <div className="card journal-card">
            <div className="journal-toolbar">
              <button type="button" className="secondary" onClick={() => shiftDay(-1)} aria-label={t(language, "journalPrevDay")}>
                <ChevronLeft size={18} />
              </button>
              <div className="journal-toolbar-center">
                <h3>
                  <CalendarDays size={14} />
                  {dayHeading}
                </h3>
                <p className="journal-range-muted">{dayYmd}</p>
              </div>
              <button type="button" className="secondary" onClick={() => shiftDay(1)} aria-label={t(language, "journalNextDay")}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="journal-day-row">
              <label className="journal-date-label">
                {t(language, "journalPickDay")}
                <input
                  type="date"
                  className="journal-date-input"
                  value={dayYmd}
                  onChange={(e) => {
                    persistDayIfChanged();
                    setDayYmd(e.target.value);
                  }}
                />
              </label>
              <button type="button" className="secondary" onClick={goToday}>
                {t(language, "journalToday")}
              </button>
            </div>
            {showWeekJumpHint && weekMeta ? (
              <p className="journal-week-link-hint">
                {t(language, "journalBelongsToWeek", {
                  week: weekMeta.week,
                  year: weekMeta.isoYear
                })}{" "}
                <button
                  type="button"
                  className="journal-inline-link"
                  onClick={() => {
                    persistDayIfChanged();
                    setWeekKey(`${weekMeta.isoYear}-W${String(weekMeta.week).padStart(2, "0")}`);
                    setMode("week");
                  }}
                >
                  {t(language, "journalOpenWeek")}
                </button>
              </p>
            ) : null}
            <JournalMarkdownField
              language={language}
              value={draftDay}
              onChange={setDraftDay}
              onBlur={persistDayIfChanged}
              placeholder={t(language, "journalDayPlaceholder")}
            />
            <p className="journal-hint">{t(language, "journalBlurHint")}</p>
            <JournalDayTradesPanel
              language={language}
              trades={trades}
              ymd={dayYmd}
              dateLabel={dayHeading}
              onEditTrade={onEditTrade}
              onDeleteTrade={onDeleteTrade}
            />
          </div>
        </div>
      )}

      {mode === "month" && (
        <div className="analytics-tab-panel">
          <div className="card journal-card">
            <div className="journal-toolbar">
              <button type="button" className="secondary" onClick={() => shiftMonth(-1)} aria-label={t(language, "journalPrevMonth")}>
                <ChevronLeft size={18} />
              </button>
              <div className="journal-toolbar-center">
                <h3>
                  <CalendarRange size={14} />
                  {monthHeading}
                </h3>
                <p className="journal-range-muted">{monthYm}</p>
              </div>
              <button type="button" className="secondary" onClick={() => shiftMonth(1)} aria-label={t(language, "journalNextMonth")}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="journal-day-row">
              <label className="journal-date-label">
                {t(language, "journalPickMonth")}
                <input
                  type="month"
                  className="journal-date-input"
                  value={monthYm}
                  onChange={(e) => {
                    persistMonthIfChanged();
                    setMonthYm(e.target.value);
                  }}
                />
              </label>
              <button type="button" className="secondary" onClick={goCurrentMonth}>
                {t(language, "journalThisMonth")}
              </button>
            </div>
            <JournalMarkdownField
              language={language}
              value={draftMonth}
              onChange={setDraftMonth}
              onBlur={persistMonthIfChanged}
              placeholder={t(language, "journalMonthPlaceholder")}
            />
            <p className="journal-hint">{t(language, "journalBlurHint")}</p>
            <JournalMonthTradesPanel
              language={language}
              trades={trades}
              ym={monthYm}
              monthLabel={monthHeading}
              onEditTrade={onEditTrade}
              onDeleteTrade={onDeleteTrade}
            />
          </div>
        </div>
      )}

      <div className="journal-ai-report-section">
        <button
          type="button"
          id="journal-ai-report-toggle"
          className="journal-ai-report-toggle"
          aria-expanded={aiReportOpen}
          aria-controls="journal-ai-report-panel"
          onClick={() => setAiReportOpen((o) => !o)}
        >
          {aiReportOpen ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
          <Sparkles size={16} aria-hidden />
          <span className="journal-ai-report-toggle-label">{t(language, "journalAiReportCardTitle")}</span>
        </button>
        {aiReportOpen ? (
          <div id="journal-ai-report-panel" className="journal-ai-report-panel-body" role="region" aria-labelledby="journal-ai-report-toggle">
            <p className="journal-ai-report-toggle-intro">{t(language, "journalAiReportCardSubtitle")}</p>
            <JournalAiReportPanel language={language} trades={trades} journalData={journalData} compactTitle />
          </div>
        ) : null}
      </div>
    </section>
  );
}
