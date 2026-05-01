import { X } from "lucide-react";
import { useMemo } from "react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { money } from "../lib/analytics";
import { buildFlatBookingRows } from "../lib/flattenBookings";
import type { Trade, TradePositionBookingKind } from "../types/trade";

function kindLabel(language: AppSettings["language"], kind: TradePositionBookingKind): string {
  if (kind === "BUY") return t(language, "buy");
  if (kind === "SELL") return t(language, "sell");
  if (kind === "INCOME") return t(language, "incomeBooking");
  return t(language, "cloudBookingKindTaxCorr");
}

function bookingLines(trade: Trade, language: AppSettings["language"], max = 14): string {
  const rows = buildFlatBookingRows([trade]);
  const lines = rows.map(
    (r) =>
      `${kindLabel(language, r.booking.kind)} · ${r.booking.bookedAtDisplay} · ${money(r.booking.grossAmount)} · ${r.booking.legacyLeg ?? "—"}`
  );
  if (lines.length <= max) return lines.join("\n");
  return `${lines.slice(0, max).join("\n")}\n… (+${lines.length - max})`;
}

function metaChangeNote(language: AppSettings["language"], before: Trade, after: Trade): string {
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`${t(language, "name")}: ${before.name} → ${after.name}`);
  if (before.typ !== after.typ) parts.push(`${t(language, "type")}: ${before.typ} → ${after.typ}`);
  if (before.basiswert !== after.basiswert) parts.push(`${t(language, "basiswert")}: ${before.basiswert || "—"} → ${after.basiswert || "—"}`);
  if (before.status !== after.status) parts.push(`${t(language, "status")}: ${before.status} → ${after.status}`);
  if (before.sourceBroker !== after.sourceBroker)
    parts.push(`${t(language, "bookingsImportPreviewBroker")}: ${before.sourceBroker ?? "—"} → ${after.sourceBroker ?? "—"}`);
  if ((before.sourceAccount ?? "") !== (after.sourceAccount ?? ""))
    parts.push(`${t(language, "bookingsImportPreviewAccount")}: ${before.sourceAccount ?? "—"} → ${after.sourceAccount ?? "—"}`);
  return parts.length > 0 ? parts.join("\n") : t(language, "bookingsImportPreviewMetaNone");
}

export interface BookingsImportPreviewModalProps {
  language: AppSettings["language"];
  format: "full" | "db";
  rowCount: number;
  updatedTradeIds: string[];
  draftTrades: Trade[];
  baselineTrades: Trade[];
  onClose: () => void;
  onConfirm: () => void;
}

export function BookingsImportPreviewModal({
  language,
  format,
  rowCount,
  updatedTradeIds,
  draftTrades,
  baselineTrades,
  onClose,
  onConfirm
}: BookingsImportPreviewModalProps) {
  const baseMap = useMemo(() => new Map(baselineTrades.map((x) => [x.id, x])), [baselineTrades]);
  const draftMap = useMemo(() => new Map(draftTrades.map((x) => [x.id, x])), [draftTrades]);

  const formatLabel = format === "full" ? t(language, "bookingsImportPreviewFormatFull") : t(language, "bookingsImportPreviewFormatDb");

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-dialog bookings-import-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookings-import-preview-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="bookings-import-preview-title">{t(language, "bookingsImportPreviewTitle")}</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label={t(language, "modalCloseAria")}>
            <X size={18} />
          </button>
        </div>

        <p className="bookings-import-preview-intro muted">
          {t(language, "bookingsImportPreviewIntro", {
            format: formatLabel,
            rows: rowCount,
            trades: updatedTradeIds.length
          })}
        </p>

        <div className="bookings-import-preview-scroll">
          <table className="bookings-import-preview-table">
            <thead>
              <tr>
                <th>{t(language, "bookingsImportPreviewThTrade")}</th>
                <th>{t(language, "bookingsImportPreviewThBookingsBefore")}</th>
                <th>{t(language, "bookingsImportPreviewThBookingsAfter")}</th>
                <th>{t(language, "bookingsImportPreviewThMeta")}</th>
              </tr>
            </thead>
            <tbody>
              {updatedTradeIds.map((id) => {
                const before = baseMap.get(id);
                const after = draftMap.get(id);
                if (!before || !after) return null;
                const beforeTxt = bookingLines(before, language);
                const afterTxt = bookingLines(after, language);
                const metaTxt = metaChangeNote(language, before, after);
                return (
                  <tr key={id}>
                    <td className="bookings-import-preview-trade-cell">
                      <strong>{after.name}</strong>
                      <div>
                        <code className="booking-leg-code">{id}</code>
                      </div>
                    </td>
                    <td>
                      <pre className="bookings-import-preview-pre">{beforeTxt}</pre>
                    </td>
                    <td>
                      <pre className="bookings-import-preview-pre">{afterTxt}</pre>
                    </td>
                    <td>
                      <pre className="bookings-import-preview-pre bookings-import-preview-meta">{metaTxt}</pre>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "bookingsImportPreviewCancel")}
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            {t(language, "bookingsImportPreviewConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
