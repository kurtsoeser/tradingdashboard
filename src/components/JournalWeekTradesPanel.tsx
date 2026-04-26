import { Briefcase, CheckCircle2, Circle, Layers, Pencil, X } from "lucide-react";
import { formatDateTimeAT } from "../app/date";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../lib/analytics";
import { filterTradesByIsoWeek, sortTradesByKaufDesc } from "../lib/journalTradeWeek";
import type { Trade } from "../types/trade";

interface JournalWeekTradesPanelProps {
  language: AppSettings["language"];
  trades: Trade[];
  isoYear: number;
  week: number;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}

function TradeTable({
  language,
  rows,
  onEditTrade,
  onDeleteTrade
}: {
  language: AppSettings["language"];
  rows: Trade[];
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
}) {
  return (
    <div className="journal-week-table-wrap">
      <table className="journal-week-table">
        <thead>
          <tr>
            <th className="journal-week-col-icon" aria-hidden />
            <th>{t(language, "buy")}</th>
            <th>{t(language, "sell")}</th>
            <th>{t(language, "name")}</th>
            <th>{t(language, "type")}</th>
            <th>{t(language, "basiswert")}</th>
            <th>{t(language, "buyEur")}</th>
            <th>{t(language, "sellEur")}</th>
            <th>{t(language, "profit")}</th>
            <th>{t(language, "action")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((trade) => (
            <tr key={trade.id}>
              <td className="journal-week-col-icon">
                {isTradeClosed(trade) ? <CheckCircle2 size={15} className="status-icon closed" /> : <Circle size={15} className="status-icon open" />}
              </td>
              <td>{formatDateTimeAT(trade.kaufzeitpunkt)}</td>
              <td>{formatDateTimeAT(trade.verkaufszeitpunkt)}</td>
              <td>{trade.name}</td>
              <td>{trade.typ}</td>
              <td>{trade.basiswert}</td>
              <td>{money(trade.kaufPreis)}</td>
              <td>{trade.verkaufPreis !== undefined ? money(trade.verkaufPreis) : "—"}</td>
              <td className={getTradeRealizedPL(trade) >= 0 ? "positive" : "negative"}>
                {isTradeClosed(trade) ? money(getTradeRealizedPL(trade)) : "—"}
              </td>
              <td>
                <div className="table-actions">
                  <button type="button" className="icon-btn action edit" title={t(language, "edit")} onClick={() => onEditTrade(trade)}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" className="icon-btn action delete" title={t(language, "delete")} onClick={() => onDeleteTrade(trade.id)}>
                    <X size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
            <TradeTable language={language} rows={weekTrades} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
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
            <TradeTable language={language} rows={openAll} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} />
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
