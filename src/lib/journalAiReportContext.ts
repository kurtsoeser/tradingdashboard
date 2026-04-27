import { formatDateTimeAT } from "../app/date";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { buildJournalAiReportMarkdown, computeJournalWeekRangeLabel, type JournalAiReportStrings } from "./buildJournalAiReport";
import type { JournalData } from "./journalStorage";
import { parseIsoWeekKey, parseLocalYmd, toLocalYmd } from "./journalIsoWeek";
import type { Trade } from "../types/trade";

function buildStrings(language: AppSettings["language"], localeUi: string, dayYmd: string, dayHeadingLong: string, weekKey: string): JournalAiReportStrings {
  return {
    docTitle: t(language, "journalAiReportDocTitle"),
    metaLocal: t(language, "journalAiReportMetaLocal"),
    standLabel: t(language, "journalAiReportStandLabel"),
    sectionOverview: t(language, "journalAiReportSectionOverview"),
    tradesTotal: (n) => t(language, "journalAiReportTradesTotal", { n }),
    openCount: (n) => t(language, "journalAiReportOpenTrades", { n }),
    closedCount: (n) => t(language, "journalAiReportClosedTrades", { n }),
    openCapitalLine: (s) => t(language, "journalAiReportOpenCapitalOverview", { s }),
    realizedPlLine: (s) => t(language, "journalAiReportRealizedPlOverview", { s }),
    sectionJournal: t(language, "journalAiReportSectionJournal"),
    dayNotesHeading: t(language, "journalAiReportDayNotesHeading", { date: `${dayYmd} (${dayHeadingLong})` }),
    weekNotesHeading: t(language, "journalAiReportWeekNotesHeading", { week: weekKey }),
    emptyNotes: t(language, "journalAiReportEmptyNotes"),
    sectionTodayTrades: t(language, "journalAiReportSectionToday"),
    todayDateLine: (ymd, long) => t(language, "journalAiReportTodayDateLine", { ymd, long }),
    noTradesToday: t(language, "journalAiReportNoTradesToday"),
    todayClosedPl: (s) => t(language, "journalAiReportTodayClosedPl", { s }),
    sectionWeekTrades: t(language, "journalAiReportSectionWeek"),
    weekHeadingLine: (wk, range) => {
      const p = parseIsoWeekKey(wk);
      if (p) return t(language, "journalAiReportWeekHeading", { week: p.week, year: p.isoYear, range });
      return `${wk} — ${range}`;
    },
    noTradesWeek: t(language, "journalAiReportNoTradesWeek"),
    weekClosedPl: (s) => t(language, "journalAiReportWeekClosedPl", { s }),
    sectionOpenPositions: t(language, "journalAiReportSectionOpen"),
    noOpenPositions: t(language, "journalAiReportNoOpen"),
    openCountLine: (n) => t(language, "journalAiReportOpenCountDetail", { n }),
    openCapitalSum: (s) => t(language, "journalAiReportOpenCapitalDetail", { s }),
    suggestedBlockTitle: t(language, "journalAiReportSuggestedTitle"),
    suggestedPrompt: t(language, "journalAiReportSuggestedBody"),
    labelBuy: t(language, "buy"),
    labelSell: t(language, "sell"),
    labelOpen: t(language, "open"),
    labelClosed: t(language, "closed"),
    labelStueck: t(language, "shares"),
    labelPl: t(language, "pl"),
    labelNotiz: t(language, "notes")
  };
}

/** Markdown-Kontext wie im Journal-KI-Bericht (für Copy-Paste oder eingebetteten Chat). */
export function buildJournalAiReportMarkdownForSession(params: {
  language: AppSettings["language"];
  trades: Trade[];
  journalData: JournalData;
  now?: Date;
  omitSuggestedPrompt?: boolean;
}): string {
  const now = params.now ?? new Date();
  const language = params.language;
  const localeUi = language === "en" ? "en-US" : "de-AT";
  const dayYmd = toLocalYmd(now);
  const dayParsed = parseLocalYmd(dayYmd);
  const dayHeadingLong =
    dayParsed !== null
      ? dayParsed.toLocaleDateString(localeUi, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : dayYmd;
  const { weekKey, rangeLabel } = computeJournalWeekRangeLabel(now, localeUi);
  const strings = buildStrings(language, localeUi, dayYmd, dayHeadingLong, weekKey);

  return buildJournalAiReportMarkdown({
    now,
    dateLocale: localeUi,
    trades: params.trades,
    journalData: params.journalData,
    strings,
    weekKey,
    weekRangeLabel: rangeLabel,
    dayYmd,
    dayHeadingLong,
    formatDateTime: formatDateTimeAT,
    omitSuggestedPrompt: params.omitSuggestedPrompt ?? false
  });
}
