import { CalendarDays } from "lucide-react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../lib/analytics";
import { filterTradesByLocalYmd, sortTradesByKaufDesc } from "../lib/journalTradeWeek";
import type { Trade } from "../types/trade";
import { JournalTradesTable } from "./JournalTradesTable";

interface JournalDayTradesPanelProps {
  language: AppSettings["language"];
  trades: Trade[];
  ymd: string;
  dateLabel: string;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}

export function JournalDayTradesPanel({ language, trades, ymd, dateLabel, onEditTrade, onDeleteTrade }: JournalDayTradesPanelProps) {
  const dayTrades = sortTradesByKaufDesc(filterTradesByLocalYmd(trades, ymd));
  const closedDayPl = dayTrades.filter(isTradeClosed).reduce((s, t) => s + getTradeRealizedPL(t), 0);

  return (
    <div className="journal-week-trades-root">
      <div className="card journal-week-trades-card">
        <h3>
          <CalendarDays size={14} />
          {t(language, "journalDayTradesTitle", { date: dateLabel })}
        </h3>
        <p className="journal-week-trades-hint">{t(language, "journalDayTradesHint")}</p>
        {dayTrades.length === 0 ? (
          <p className="journal-week-empty">{t(language, "journalDayNoTrades")}</p>
        ) : (
          <>
            <JournalTradesTable language={language} rows={dayTrades} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
            <div className="journal-week-summary">
              <span>{t(language, "journalWeekSummaryCount", { n: dayTrades.length })}</span>
              {dayTrades.some(isTradeClosed) ? (
                <span className={closedDayPl >= 0 ? "positive" : "negative"}>
                  {t(language, "journalWeekSummaryClosedPl")}: {money(closedDayPl)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
