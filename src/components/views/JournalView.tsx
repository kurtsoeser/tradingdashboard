import { BookMarked, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
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
import { JournalWeekTradesPanel } from "../JournalWeekTradesPanel";
import type { Trade } from "../../types/trade";

interface JournalViewProps {
  language: AppSettings["language"];
  journalData: JournalData;
  trades: Trade[];
  onJournalDayChange: (ymd: string, text: string) => void;
  onJournalWeekChange: (weekKey: string, text: string) => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}

export function JournalView({
  language,
  journalData,
  trades,
  onJournalDayChange,
  onJournalWeekChange,
  onEditTrade,
  onDeleteTrade
}: JournalViewProps) {
  const locale = language === "en" ? "en-US" : "de-AT";
  const [mode, setMode] = useState<"week" | "day">("week");
  const [weekKey, setWeekKey] = useState(() => toIsoWeekKey(new Date()));
  const [dayYmd, setDayYmd] = useState(() => toLocalYmd(new Date()));
  const [draftWeek, setDraftWeek] = useState("");
  const [draftDay, setDraftDay] = useState("");

  useEffect(() => {
    setDraftWeek(journalData.byWeek[weekKey] ?? "");
  }, [weekKey, journalData.byWeek]);

  useEffect(() => {
    setDraftDay(journalData.byDay[dayYmd] ?? "");
  }, [dayYmd, journalData.byDay]);

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

  const shiftWeek = (delta: number) => {
    const p = parseIsoWeekKey(weekKey);
    if (!p) return;
    const mon = mondayOfIsoWeek(p.isoYear, p.week);
    const next = addDaysLocal(mon, delta * 7);
    setWeekKey(toIsoWeekKey(next));
  };

  const persistWeekIfChanged = () => {
    const prev = journalData.byWeek[weekKey] ?? "";
    if (draftWeek !== prev) onJournalWeekChange(weekKey, draftWeek);
  };

  const persistDayIfChanged = () => {
    const prev = journalData.byDay[dayYmd] ?? "";
    if (draftDay !== prev) onJournalDayChange(dayYmd, draftDay);
  };

  const goThisWeek = () => setWeekKey(toIsoWeekKey(new Date()));
  const goToday = () => setDayYmd(toLocalYmd(new Date()));

  const dayParsed = parseLocalYmd(dayYmd);
  const dayHeading =
    dayParsed !== null
      ? dayParsed.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      : dayYmd;

  const weekMeta = dayParsed ? getIsoWeekYearAndWeek(dayParsed) : null;
  const dayWeekKey = weekMeta ? `${weekMeta.isoYear}-W${String(weekMeta.week).padStart(2, "0")}` : null;
  const showWeekJumpHint = Boolean(weekMeta && dayWeekKey && dayWeekKey !== weekKey);

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
        <button type="button" className={mode === "week" ? "secondary active" : "secondary"} onClick={() => setMode("week")}>
          {t(language, "journalTabWeek")}
        </button>
        <button type="button" className={mode === "day" ? "secondary active" : "secondary"} onClick={() => setMode("day")}>
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
            <div className="journal-day-row">
              <label className="journal-date-label">
                {t(language, "journalPickDay")}
                <input type="date" className="journal-date-input" value={dayYmd} onChange={(e) => setDayYmd(e.target.value)} />
              </label>
              <button type="button" className="secondary" onClick={goToday}>
                {t(language, "journalToday")}
              </button>
            </div>
            <h3 className="journal-day-heading">{dayHeading}</h3>
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
          </div>
        </div>
      )}
    </section>
  );
}
