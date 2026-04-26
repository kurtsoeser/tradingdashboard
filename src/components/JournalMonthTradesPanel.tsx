import { CalendarRange } from "lucide-react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../lib/analytics";
import { filterTradesByLocalYm, sortTradesByKaufDesc } from "../lib/journalTradeWeek";
import type { Trade } from "../types/trade";
import { JournalTradesTable } from "./JournalTradesTable";

interface JournalMonthTradesPanelProps {
  language: AppSettings["language"];
  trades: Trade[];
  ym: string;
  monthLabel: string;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}

export function JournalMonthTradesPanel({ language, trades, ym, monthLabel, onEditTrade, onDeleteTrade }: JournalMonthTradesPanelProps) {
  const monthTrades = sortTradesByKaufDesc(filterTradesByLocalYm(trades, ym));
  const closedMonthPl = monthTrades.filter(isTradeClosed).reduce((s, tr) => s + getTradeRealizedPL(tr), 0);

  return (
    <div className="journal-week-trades-root">
      <div className="card journal-week-trades-card">
        <h3>
          <CalendarRange size={14} />
          {t(language, "journalMonthTradesTitle", { month: monthLabel })}
        </h3>
        <p className="journal-week-trades-hint">{t(language, "journalMonthTradesHint")}</p>
        {monthTrades.length === 0 ? (
          <p className="journal-week-empty">{t(language, "journalMonthNoTrades")}</p>
        ) : (
          <>
            <JournalTradesTable language={language} rows={monthTrades} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
            <div className="journal-week-summary">
              <span>{t(language, "journalWeekSummaryCount", { n: monthTrades.length })}</span>
              {monthTrades.some(isTradeClosed) ? (
                <span className={closedMonthPl >= 0 ? "positive" : "negative"}>
                  {t(language, "journalWeekSummaryClosedPl")}: {money(closedMonthPl)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
