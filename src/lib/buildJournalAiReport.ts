import type { JournalData } from "./journalStorage";
import {
  filterTradesByIsoWeek,
  filterTradesByLocalYmd,
  sortTradesByKaufDesc
} from "./journalTradeWeek";
import { mondayOfIsoWeek, parseIsoWeekKey, sundayOfIsoWeek, toIsoWeekKey } from "./journalIsoWeek";
import { getKpis, getTradeRealizedPL, isTradeClosed, money } from "./analytics";
import type { Trade } from "../types/trade";

export type JournalAiReportStrings = {
  docTitle: string;
  metaLocal: string;
  standLabel: string;
  sectionOverview: string;
  tradesTotal: (n: number) => string;
  openCount: (n: number) => string;
  closedCount: (n: number) => string;
  openCapitalLine: (s: string) => string;
  realizedPlLine: (s: string) => string;
  sectionJournal: string;
  dayNotesHeading: string;
  weekNotesHeading: string;
  emptyNotes: string;
  sectionTodayTrades: string;
  todayDateLine: (ymd: string, longDate: string) => string;
  noTradesToday: string;
  todayClosedPl: (s: string) => string;
  sectionWeekTrades: string;
  weekHeadingLine: (weekKey: string, range: string) => string;
  noTradesWeek: string;
  weekClosedPl: (s: string) => string;
  sectionOpenPositions: string;
  noOpenPositions: string;
  openCountLine: (n: number) => string;
  openCapitalSum: (s: string) => string;
  suggestedBlockTitle: string;
  suggestedPrompt: string;
  labelBuy: string;
  labelSell: string;
  labelOpen: string;
  labelClosed: string;
  labelStueck: string;
  labelPl: string;
  labelNotiz: string;
};

function fenceMarkdownUserBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return `~~~\n${trimmed.replace(/~/g, "\\~")}\n~~~`;
}

function formatTradeLine(
  trade: Trade,
  s: JournalAiReportStrings,
  formatDateTime: (v?: string) => string,
  formatMoney: (n: number) => string
): string {
  const parts: string[] = [];
  parts.push(`**${trade.name || "—"}**`);
  parts.push(`${trade.basiswert || "—"} (${trade.typ})`);
  parts.push(`${s.labelBuy}: ${formatDateTime(trade.kaufzeitpunkt)} → ${formatMoney(trade.kaufPreis ?? 0)}`);
  if (trade.stueck !== undefined && Number.isFinite(trade.stueck)) {
    parts.push(`${s.labelStueck}: ${trade.stueck}`);
  }
  if (isTradeClosed(trade)) {
    parts.push(`${s.labelClosed}`);
    if (trade.verkaufszeitpunkt) parts.push(`${s.labelSell}: ${formatDateTime(trade.verkaufszeitpunkt)}`);
    if (trade.verkaufPreis !== undefined) parts.push(`${formatMoney(trade.verkaufPreis)}`);
    parts.push(`${s.labelPl}: ${formatMoney(getTradeRealizedPL(trade))}`);
  } else {
    parts.push(`${s.labelOpen}`);
  }
  if (trade.notiz?.trim()) {
    parts.push(`${s.labelNotiz}: ${trade.notiz.trim().replace(/\s+/g, " ")}`);
  }
  return `- ${parts.join(" · ")}`;
}

export function computeJournalWeekRangeLabel(now: Date, locale: string): { weekKey: string; rangeLabel: string; parsed: { isoYear: number; week: number } | null } {
  const weekKey = toIsoWeekKey(now);
  const parsed = parseIsoWeekKey(weekKey);
  if (!parsed) return { weekKey, rangeLabel: "", parsed: null };
  const mon = mondayOfIsoWeek(parsed.isoYear, parsed.week);
  const sun = sundayOfIsoWeek(parsed.isoYear, parsed.week);
  const a = mon.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const b = sun.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  return { weekKey, rangeLabel: `${a} – ${b}`, parsed };
}

export function buildJournalAiReportMarkdown(input: {
  now: Date;
  dateLocale: string;
  trades: Trade[];
  journalData: JournalData;
  strings: JournalAiReportStrings;
  weekKey: string;
  weekRangeLabel: string;
  dayYmd: string;
  dayHeadingLong: string;
  formatDateTime: (v?: string) => string;
  /** Für eingebetteten Chat: Prompt-Vorschlag am Ende weglassen (weniger Tokens). */
  omitSuggestedPrompt?: boolean;
}): string {
  const { now, dateLocale, trades, journalData, strings: s, weekKey, weekRangeLabel, dayYmd, dayHeadingLong, formatDateTime, omitSuggestedPrompt } = input;
  const formatMoney = (n: number) => money(n);
  const kpis = getKpis(trades);
  const parsedWeek = parseIsoWeekKey(weekKey);

  const standFormatted = now.toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" });

  const dayNotes = journalData.byDay[dayYmd]?.trim() ?? "";
  const weekNotes = journalData.byWeek[weekKey]?.trim() ?? "";

  const todayTrades = sortTradesByKaufDesc(filterTradesByLocalYmd(trades, dayYmd));
  const weekTrades =
    parsedWeek !== null
      ? sortTradesByKaufDesc(filterTradesByIsoWeek(trades, parsedWeek.isoYear, parsedWeek.week))
      : [];
  const openTrades = sortTradesByKaufDesc(trades.filter((t) => !isTradeClosed(t)));

  const todayClosedPl = todayTrades.filter(isTradeClosed).reduce((sum, t) => sum + getTradeRealizedPL(t), 0);
  const weekClosedPl = weekTrades.filter(isTradeClosed).reduce((sum, t) => sum + getTradeRealizedPL(t), 0);

  const lines: string[] = [];
  lines.push(s.docTitle);
  lines.push("");
  lines.push(`**${s.standLabel}** ${standFormatted}`);
  lines.push(`*${s.metaLocal}*`);
  lines.push("");
  lines.push(`## ${s.sectionOverview}`);
  lines.push(`- ${s.tradesTotal(kpis.totalTrades)}`);
  lines.push(`- ${s.openCount(kpis.openTrades)}`);
  lines.push(`- ${s.closedCount(kpis.closedTrades)}`);
  lines.push(`- ${s.openCapitalLine(formatMoney(kpis.openCapital))}`);
  lines.push(`- ${s.realizedPlLine(formatMoney(kpis.totalPL))}`);
  lines.push("");
  lines.push(`## ${s.sectionJournal}`);
  lines.push(`### ${s.dayNotesHeading}`);
  lines.push(dayNotes ? fenceMarkdownUserBlock(dayNotes) : `*${s.emptyNotes}*`);
  lines.push("");
  lines.push(`### ${s.weekNotesHeading}`);
  lines.push(weekNotes ? fenceMarkdownUserBlock(weekNotes) : `*${s.emptyNotes}*`);
  lines.push("");
  lines.push(`## ${s.sectionTodayTrades}`);
  lines.push(s.todayDateLine(dayYmd, dayHeadingLong));
  lines.push("");
  if (todayTrades.length === 0) {
    lines.push(`*${s.noTradesToday}*`);
  } else {
    for (const t of todayTrades) {
      lines.push(formatTradeLine(t, s, formatDateTime, formatMoney));
    }
    lines.push("");
    lines.push(s.todayClosedPl(formatMoney(todayClosedPl)));
  }
  lines.push("");
  lines.push(`## ${s.sectionWeekTrades}`);
  lines.push(s.weekHeadingLine(weekKey, weekRangeLabel));
  lines.push("");
  if (weekTrades.length === 0) {
    lines.push(`*${s.noTradesWeek}*`);
  } else {
    for (const t of weekTrades) {
      lines.push(formatTradeLine(t, s, formatDateTime, formatMoney));
    }
    lines.push("");
    lines.push(s.weekClosedPl(formatMoney(weekClosedPl)));
  }
  lines.push("");
  lines.push(`## ${s.sectionOpenPositions}`);
  if (openTrades.length === 0) {
    lines.push(`*${s.noOpenPositions}*`);
  } else {
    lines.push(s.openCountLine(openTrades.length));
    lines.push(s.openCapitalSum(formatMoney(openTrades.reduce((sum, t) => sum + (t.kaufPreis ?? 0), 0))));
    lines.push("");
    for (const t of openTrades) {
      lines.push(formatTradeLine(t, s, formatDateTime, formatMoney));
    }
  }
  lines.push("");
  if (!omitSuggestedPrompt) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${s.suggestedBlockTitle}`);
    lines.push(s.suggestedPrompt);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
