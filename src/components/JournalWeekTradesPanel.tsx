import { Briefcase, Layers } from "lucide-react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../lib/analytics";
import { filterTradesByIsoWeek, sortTradesByKaufDesc } from "../lib/journalTradeWeek";
import type { Trade } from "../types/trade";
import { JournalTradesTable } from "./JournalTradesTable";

interface JournalWeekTradesPanelProps {
  language: AppSettings["language"];
  trades: Trade[];
  isoYear: number;
  week: number;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}

export function JournalWeekTradesPanel({ language, trades, isoYear, week, onEditTrade, onDeleteTrade }: JournalWeekTradesPanelProps) {
  const weekTrades = sortTradesByKaufDesc(filterTradesByIsoWeek(trades, isoYear, week));
  const openAll = sortTradesByKaufDesc(trades.filter((t) => !isTradeClosed(t)));
  const closedWeekPl = weekTrades.filter(isTradeClosed).reduce((s, t) => s + getTradeRealizedPL(t), 0);
  const openCapital = openAll.reduce((s, t) => s + (t.kaufPreis ?? 0), 0);

  return (
    <div className="journal-week-trades-root">
      <div className="card journal-week-trades-card">
        <h3>
          <Layers size={14} />
          {t(language, "journalWeekTradesTitle", { week, year: isoYear })}
        </h3>
        <p className="journal-week-trades-hint">{t(language, "journalWeekTradesHint")}</p>
        {weekTrades.length === 0 ? (
          <p className="journal-week-empty">{t(language, "journalWeekNoTrades")}</p>
        ) : (
          <>
            <JournalTradesTable language={language} rows={weekTrades} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
            <div className="journal-week-summary">
              <span>{t(language, "journalWeekSummaryCount", { n: weekTrades.length })}</span>
              {weekTrades.some(isTradeClosed) ? (
                <span className={closedWeekPl >= 0 ? "positive" : "negative"}>
                  {t(language, "journalWeekSummaryClosedPl")}: {money(closedWeekPl)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="card journal-week-trades-card">
        <h3>
          <Briefcase size={14} />
          {t(language, "journalWeekOpenTitle")}
        </h3>
        <p className="journal-week-trades-hint">{t(language, "journalWeekOpenHint")}</p>
        {openAll.length === 0 ? (
          <p className="journal-week-empty">{t(language, "journalWeekNoOpen")}</p>
        ) : (
          <>
            <JournalTradesTable language={language} rows={openAll} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
            <div className="journal-week-summary">
              <span>{t(language, "journalWeekOpenCount", { n: openAll.length })}</span>
              <span>
                {t(language, "openCapital")}: {money(openCapital)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
