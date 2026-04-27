import { CheckCircle2, Circle, Pencil, X } from "lucide-react";
import { formatDateTimeAT } from "../app/date";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { getTradeRealizedPL, isTradeClosed, money } from "../lib/analytics";
import type { Trade } from "../types/trade";

export function JournalTradesTable({
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
            <th>ISIN</th>
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
              <td>{trade.isin || "—"}</td>
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
