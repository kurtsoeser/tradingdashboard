import { formatDateTimeAT, parseStoredDateTime, toLocalInputValue } from "../app/date";
import type { Trade, TradePositionBooking, TradePositionBookingKind } from "../types/trade";

function toBookedAtIsoFromTradeField(value: string): string {
  const d = parseStoredDateTime(value);
  if (d) return d.toISOString();
  const raw = new Date(value);
  return Number.isNaN(raw.getTime()) ? new Date().toISOString() : raw.toISOString();
}

function toBookedAtDisplayFromIso(iso: string): string {
  return formatDateTimeAT(iso) || iso;
}

/** Startliste für den Buchungen-Editor (ohne Cloud-Daten). */
export function syntheticBookingsFromTrade(trade: Trade): TradePositionBooking[] {
  if (trade.typ === "Steuerkorrektur") {
    return [
      {
        transactionId: "",
        kind: "TAX_CORRECTION",
        bookedAtIso: toBookedAtIsoFromTradeField(trade.kaufzeitpunkt),
        bookedAtDisplay: toBookedAtDisplayFromIso(toBookedAtIsoFromTradeField(trade.kaufzeitpunkt)),
        grossAmount: 0,
        feesAmount: 0,
        taxAmount: trade.verkaufSteuern ?? 0,
        legacyLeg: "TAX_CORRECTION"
      }
    ];
  }

  if (trade.typ === "Dividende" || trade.typ === "Zinszahlung") {
    const gross =
      trade.verkaufTransaktionManuell !== undefined && Number.isFinite(trade.verkaufTransaktionManuell)
        ? trade.verkaufTransaktionManuell
        : Math.max(0, (trade.verkaufPreis ?? 0) - (trade.verkaufSteuern ?? 0) + (trade.verkaufGebuehren ?? 0));
    const iso = toBookedAtIsoFromTradeField(trade.kaufzeitpunkt);
    return [
      {
        transactionId: "",
        kind: "INCOME",
        bookedAtIso: iso,
        bookedAtDisplay: toBookedAtDisplayFromIso(iso),
        grossAmount: gross,
        feesAmount: 0,
        taxAmount: trade.verkaufSteuern ?? 0,
        legacyLeg: "INCOME"
      }
    ];
  }

  const qty = trade.stueck && trade.stueck > 0 ? trade.stueck : 1;
  const buyGross = trade.kaufTransaktionManuell ?? Math.max(0, (trade.kaufPreis ?? 0) - (trade.kaufGebuehren ?? 0));
  const buyUnit = trade.kaufStueckpreis ?? (qty > 0 ? buyGross / qty : Math.max(0, trade.kaufPreis ?? 0));
  const buyIso = toBookedAtIsoFromTradeField(trade.kaufzeitpunkt);

  const rows: TradePositionBooking[] = [
    {
      transactionId: "",
      kind: "BUY",
      bookedAtIso: buyIso,
      bookedAtDisplay: toBookedAtDisplayFromIso(buyIso),
      qty,
      unitPrice: buyUnit,
      grossAmount: buyGross,
      feesAmount: trade.kaufGebuehren ?? 0,
      taxAmount: 0,
      legacyLeg: "BUY"
    }
  ];

  if (trade.status === "Geschlossen") {
    const sellGross =
      trade.verkaufTransaktionManuell ??
      Math.max(0, (trade.verkaufPreis ?? 0) - (trade.verkaufSteuern ?? 0) + (trade.verkaufGebuehren ?? 0));
    const sellUnit = trade.verkaufStueckpreis ?? (qty > 0 ? sellGross / qty : Math.max(0, trade.verkaufPreis ?? 0));
    const sellTime = trade.verkaufszeitpunkt ?? trade.kaufzeitpunkt;
    const sellIso = toBookedAtIsoFromTradeField(sellTime);
    rows.push({
      transactionId: "",
      kind: "SELL",
      bookedAtIso: sellIso,
      bookedAtDisplay: toBookedAtDisplayFromIso(sellIso),
      qty,
      unitPrice: sellUnit,
      grossAmount: sellGross,
      feesAmount: trade.verkaufGebuehren ?? 0,
      taxAmount: Math.max(0, trade.verkaufSteuern ?? 0),
      legacyLeg: "SELL"
    });
  }

  return rows;
}

export function cloneBookings(rows: TradePositionBooking[]): TradePositionBooking[] {
  return rows.map((r) => ({ ...r }));
}

/**
 * Letzte SELL-Zeile an das Verkaufsdatum der Verkaufs-Kachel anpassen (`datetime-local` aus dem Formular),
 * damit Speichern/Cloud nicht einen veralteten SELL-Zeitstempel aus der Buchungstabelle behält.
 */
export function syncLastSellBookingTimeFromForm(rows: TradePositionBooking[], verkaufFormLocal: string): TradePositionBooking[] {
  const trimmed = verkaufFormLocal.trim();
  if (!trimmed) return rows;
  const d = parseStoredDateTime(trimmed);
  if (!d || Number.isNaN(d.getTime())) return rows;
  const iso = d.toISOString();
  const display = formatDateTimeAT(iso) || iso;
  const sellIndices = rows.map((r, i) => (r.kind === "SELL" ? i : -1)).filter((i) => i >= 0);
  if (sellIndices.length === 0) return rows;
  const targetIdx = sellIndices[sellIndices.length - 1]!;
  return rows.map((r, i) => (i === targetIdx ? { ...r, bookedAtIso: iso, bookedAtDisplay: display } : r));
}

/** Stabile legacy_leg für DB (Unique pro Trade): BUY, BUY_2, … / SELL, SELL_2, … / TAX_CORRECTION, … */
export function assignLegacyLegs(rows: TradePositionBooking[]): TradePositionBooking[] {
  let buyN = 0;
  let sellN = 0;
  let taxN = 0;
  let incomeN = 0;
  return rows.map((r) => {
    if (r.kind === "TAX_CORRECTION") {
      taxN += 1;
      return { ...r, legacyLeg: taxN === 1 ? "TAX_CORRECTION" : `TAX_CORRECTION_${taxN}` };
    }
    if (r.kind === "INCOME") {
      incomeN += 1;
      return { ...r, legacyLeg: incomeN === 1 ? "INCOME" : `INCOME_${incomeN}` };
    }
    if (r.kind === "BUY") {
      buyN += 1;
      return { ...r, legacyLeg: buyN === 1 ? "BUY" : `BUY_${buyN}` };
    }
    sellN += 1;
    return { ...r, legacyLeg: sellN === 1 ? "SELL" : `SELL_${sellN}` };
  });
}

/** Robuster Zahlen-Extrakt (fehlende/NaN-Werte aus Import oder fehlerhaften Eingaben). */
function safeBookingNum(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** Brutto-Zeile für Summen: gespeichertes `grossAmount` (manuell überschreibbar), nicht erneut aus Menge×Preis. */
function legGross(b: TradePositionBooking): number {
  return safeBookingNum(b.grossAmount);
}

function fmtStueckFromSum(sumQty: number): string {
  if (!Number.isFinite(sumQty) || sumQty < 0) return "0";
  const rounded = Math.round(sumQty);
  if (Math.abs(sumQty - rounded) < 1e-9) return String(rounded);
  return sumQty
    .toFixed(6)
    .replace(/\.?0+$/, "");
}

/** Aus BUY-Zeilen für Kaufdaten-Kachel (Formularstrings). */
export type TradeFormBuyAggregate = {
  kaufzeitpunkt: string;
  stueck: string;
  kaufStueckpreis: string;
  kaufTransaktionManuell: string;
  kaufGebuehren: string;
  kaufPreisManuell: string;
};

/** Aus SELL-Zeilen für Verkaufsdaten-Kachel. */
export type TradeFormSellAggregate = {
  verkaufszeitpunkt: string;
  /** Summe aller SELL-`qty` (Verkaufs-Stückzahl). */
  stueckVerkauf: string;
  verkaufStueckpreis: string;
  verkaufTransaktionManuell: string;
  verkaufGebuehren: string;
  verkaufPreisManuell: string;
};

/**
 * Aggregiert Kauf- bzw. Verkaufs-Kachel aus Buchungszeilen:
 * Kaufzeit = früheste BUY-Zeile; Verkaufszeit = späteste SELL-Zeile (Tranchen);
 * Stück = Summe, Stückpreis = Brutto-Summe / Stück, Transaktion = Summe Brutto,
 * Gebühren = Summe Gebühren, Kauf/Verkauf-Preis manuell leer (rechnerisch aus Brutto+Gebühren).
 */
export function tradeFormAggregatesFromBookings(rows: TradePositionBooking[]): {
  buy: TradeFormBuyAggregate | null;
  sell: TradeFormSellAggregate | null;
} {
  const buys = rows.filter((r) => r.kind === "BUY");
  const sells = rows.filter((r) => r.kind === "SELL");

  const buy: TradeFormBuyAggregate | null =
    buys.length === 0
      ? null
      : (() => {
          const byTime = [...buys].sort(
            (a, b) =>
              (parseStoredDateTime(a.bookedAtIso)?.getTime() ?? 0) -
              (parseStoredDateTime(b.bookedAtIso)?.getTime() ?? 0)
          );
          const first = byTime[0]!;
          let sumQty = 0;
          let sumGross = 0;
          let sumFees = 0;
          for (const b of buys) {
            sumQty += safeBookingNum(b.qty);
            sumGross += legGross(b);
            sumFees += safeBookingNum(b.feesAmount);
          }
          if (!Number.isFinite(sumQty)) sumQty = 0;
          if (!Number.isFinite(sumGross)) sumGross = 0;
          if (!Number.isFinite(sumFees)) sumFees = 0;
          sumGross = Math.round(sumGross * 100) / 100;
          sumFees = Math.round(sumFees * 100) / 100;
          const avgUnit = sumQty > 0 && Number.isFinite(sumGross) ? sumGross / sumQty : 0;
          return {
            kaufzeitpunkt: toLocalInputValue(first.bookedAtIso) || "",
            stueck: fmtStueckFromSum(sumQty),
            kaufStueckpreis: avgUnit > 0 ? avgUnit.toFixed(6) : "",
            kaufTransaktionManuell: sumGross.toFixed(2),
            kaufGebuehren: sumFees.toFixed(2),
            kaufPreisManuell: ""
          };
        })();

  const sell: TradeFormSellAggregate | null =
    sells.length === 0
      ? null
      : (() => {
          const byTimeDesc = [...sells].sort(
            (a, b) =>
              (parseStoredDateTime(b.bookedAtIso)?.getTime() ?? 0) -
              (parseStoredDateTime(a.bookedAtIso)?.getTime() ?? 0)
          );
          const lastSell = byTimeDesc[0]!;
          let sumQty = 0;
          let sumGross = 0;
          let sumFees = 0;
          for (const b of sells) {
            sumQty += safeBookingNum(b.qty);
            sumGross += legGross(b);
            sumFees += safeBookingNum(b.feesAmount);
          }
          if (!Number.isFinite(sumQty)) sumQty = 0;
          if (!Number.isFinite(sumGross)) sumGross = 0;
          if (!Number.isFinite(sumFees)) sumFees = 0;
          sumGross = Math.round(sumGross * 100) / 100;
          sumFees = Math.round(sumFees * 100) / 100;
          const avgUnit = sumQty > 0 && Number.isFinite(sumGross) ? sumGross / sumQty : 0;
          return {
            verkaufszeitpunkt: toLocalInputValue(lastSell.bookedAtIso) || "",
            stueckVerkauf: fmtStueckFromSum(sumQty),
            verkaufStueckpreis: avgUnit > 0 ? avgUnit.toFixed(6) : "",
            verkaufTransaktionManuell: sumGross.toFixed(2),
            verkaufGebuehren: sumFees.toFixed(2),
            verkaufPreisManuell: ""
          };
        })();

  return { buy, sell };
}

export function emptyBookingRow(kind: TradePositionBookingKind): TradePositionBooking {
  const iso = new Date().toISOString();
  if (kind === "TAX_CORRECTION") {
    return {
      transactionId: "",
      kind: "TAX_CORRECTION",
      bookedAtIso: iso,
      bookedAtDisplay: toBookedAtDisplayFromIso(iso),
      grossAmount: 0,
      feesAmount: 0,
      taxAmount: 0
    };
  }
  if (kind === "INCOME") {
    return {
      transactionId: "",
      kind: "INCOME",
      bookedAtIso: iso,
      bookedAtDisplay: toBookedAtDisplayFromIso(iso),
      grossAmount: 0,
      feesAmount: 0,
      taxAmount: 0
    };
  }
  return {
    transactionId: "",
    kind,
    bookedAtIso: iso,
    bookedAtDisplay: toBookedAtDisplayFromIso(iso),
    qty: 1,
    unitPrice: 0,
    grossAmount: 0,
    feesAmount: 0,
    taxAmount: 0
  };
}
