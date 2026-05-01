import type { Trade, TradePositionBooking } from "../types/trade";
import { assignLegacyLegs, cloneBookings, syntheticBookingsFromTrade } from "./bookingsDraft";

export interface FlatBookingRow {
  rowKey: string;
  tradeId: string;
  tradeName: string;
  tradeTyp: string;
  basiswert: string;
  tradeStatus: Trade["status"];
  tradeManualChecked: boolean;
  booking: TradePositionBooking;
}

function bookingTimeMs(b: FlatBookingRow["booking"]): number {
  const raw = Date.parse(b.bookedAtIso);
  return Number.isFinite(raw) ? raw : 0;
}

/** Alle Buchungszeilen aller Trades (gespeicherte `bookings` oder synthetisch wie in der Trade-Bearbeitung). Neueste zuerst. */
export function buildFlatBookingRows(trades: Trade[]): FlatBookingRow[] {
  const out: FlatBookingRow[] = [];
  for (const trade of trades) {
    const rows =
      trade.bookings && trade.bookings.length > 0
        ? assignLegacyLegs(cloneBookings(trade.bookings))
        : syntheticBookingsFromTrade(trade);
    rows.forEach((b, idx) => {
      out.push({
        rowKey: `${trade.id}:${b.transactionId || "local"}:${idx}:${b.legacyLeg ?? b.kind}`,
        tradeId: trade.id,
        tradeName: trade.name,
        tradeTyp: trade.typ,
        basiswert: trade.basiswert,
        tradeStatus: trade.status,
        tradeManualChecked: !!trade.manualChecked,
        booking: b
      });
    });
  }
  return out.sort((a, b) => bookingTimeMs(b.booking) - bookingTimeMs(a.booking));
}
