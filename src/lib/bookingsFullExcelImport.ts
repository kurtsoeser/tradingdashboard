import * as XLSX from "xlsx";
import type { WorkBook } from "xlsx";
import { formatDateTimeAT, parseStoredDateTime, toDisplayDateTime, toLocalInputValue } from "../app/date";
import type { Trade, TradePositionBooking, TradePositionBookingKind } from "../types/trade";
import { canonicalizeBasiswert } from "./basiswertCanonical";
import { assignLegacyLegs, tradeFormAggregatesFromBookings } from "./bookingsDraft";

const REQUIRED_HEADERS = [
  "trade_id",
  "booking_kind",
  "booked_at_iso",
  "gross_amount",
  "fees_amount",
  "tax_amount"
] as const;

function pick(row: Record<string, unknown>, key: string): unknown {
  const want = key.toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (String(k).trim().toLowerCase() === want) return v;
  }
  return undefined;
}

function parseExcelNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/€/g, "")
    .replace(/\u2212/g, "-");
  let normalized = cleaned;
  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");
  if (hasDot && hasComma) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalQty(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseExcelNumber(value);
  return n === 0 && String(value).trim() === "" ? undefined : n;
}

function parseBookingKind(raw: unknown): TradePositionBookingKind | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "BUY" || s === "SELL" || s === "INCOME" || s === "TAX_CORRECTION") return s;
  return null;
}

/** ISO-String oder Excel-Datum / Zahl (Serientag) grob in ISO umsetzen. */
function coerceBookedAtIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const d2 = parseStoredDateTime(s);
  return d2 && !Number.isNaN(d2.getTime()) ? d2.toISOString() : null;
}

function rowKeysMatchHeader(row: Record<string, unknown>): boolean {
  const keys = new Set(Object.keys(row).map((k) => k.trim().toLowerCase()));
  return REQUIRED_HEADERS.every((h) => keys.has(h));
}

function syncTradeTopLevelFromBookings(trade: Trade, bookings: TradePositionBooking[]): Trade {
  const typ = trade.typ;

  if (typ === "Steuerkorrektur") {
    const b = bookings.find((x) => x.kind === "TAX_CORRECTION") ?? bookings[0];
    const kt = b?.bookedAtIso ? toDisplayDateTime(toLocalInputValue(b.bookedAtIso)) : trade.kaufzeitpunkt;
    return {
      ...trade,
      bookings,
      basiswert: "",
      kaufzeitpunkt: kt,
      verkaufSteuern: b ? b.taxAmount : trade.verkaufSteuern,
      kaufPreis: 0,
      verkaufPreis: 0,
      stueck: undefined,
      verkaufszeitpunkt: undefined,
      verkaufTransaktionManuell: undefined,
      verkaufGebuehren: undefined,
      gewinn: undefined
    };
  }

  if (typ === "Dividende" || typ === "Zinszahlung") {
    const incs = bookings.filter((x) => x.kind === "INCOME");
    const sorted = [...incs].sort(
      (a, b) => (parseStoredDateTime(a.bookedAtIso)?.getTime() ?? 0) - (parseStoredDateTime(b.bookedAtIso)?.getTime() ?? 0)
    );
    const first = sorted[0] ?? bookings[0];
    const grossSum = incs.reduce((s, b) => s + (Number.isFinite(b.grossAmount) ? b.grossAmount : 0), 0);
    const taxSum = incs.reduce((s, b) => s + (Number.isFinite(b.taxAmount) ? b.taxAmount : 0), 0);
    const feeSum = incs.reduce((s, b) => s + (Number.isFinite(b.feesAmount) ? b.feesAmount : 0), 0);
    const verkaufPreis = grossSum + taxSum + feeSum;
    const kt = first?.bookedAtIso ? toDisplayDateTime(toLocalInputValue(first.bookedAtIso)) : trade.kaufzeitpunkt;
    return {
      ...trade,
      bookings,
      kaufzeitpunkt: kt,
      kaufPreis: 0,
      verkaufTransaktionManuell: grossSum,
      verkaufSteuern: taxSum,
      verkaufGebuehren: feeSum,
      verkaufPreis,
      gewinn: trade.status === "Geschlossen" ? verkaufPreis : undefined,
      verkaufszeitpunkt: undefined,
      stueck: undefined,
      kaufStueckpreis: undefined
    };
  }

  const { buy, sell } = tradeFormAggregatesFromBookings(bookings);
  if (!buy) {
    return { ...trade, bookings };
  }

  const kaufTrans = Number.parseFloat(buy.kaufTransaktionManuell) || 0;
  const kaufGeb = Number.parseFloat(buy.kaufGebuehren) || 0;
  const stueckN = Number.parseFloat(buy.stueck) || 0;
  const kaufStueckpreisN = Number.parseFloat(buy.kaufStueckpreis) || 0;
  const kaufPreis = kaufTrans + kaufGeb;

  let next: Trade = {
    ...trade,
    bookings,
    kaufzeitpunkt: toDisplayDateTime(buy.kaufzeitpunkt),
    stueck: stueckN > 0 ? stueckN : undefined,
    kaufStueckpreis: kaufStueckpreisN > 0 ? kaufStueckpreisN : undefined,
    kaufTransaktionManuell: kaufTrans,
    kaufGebuehren: kaufGeb,
    kaufPreis,
    kaufPreisManuell: undefined
  };

  if (sell) {
    const vTrans = Number.parseFloat(sell.verkaufTransaktionManuell) || 0;
    const vGeb = Number.parseFloat(sell.verkaufGebuehren) || 0;
    const verkaufErlos = vTrans - vGeb;
    const sellTaxSum = bookings.filter((b) => b.kind === "SELL").reduce((s, b) => s + b.taxAmount, 0);
    const verkaufPreis = verkaufErlos + sellTaxSum;
    next = {
      ...next,
      verkaufszeitpunkt: toDisplayDateTime(sell.verkaufszeitpunkt),
      verkaufTransaktionManuell: vTrans,
      verkaufGebuehren: vGeb,
      verkaufStueckpreis: Number.parseFloat(sell.verkaufStueckpreis) || undefined,
      verkaufPreisManuell: undefined,
      verkaufSteuern: sellTaxSum,
      verkaufPreis: next.status === "Geschlossen" ? verkaufPreis : undefined,
      gewinn: next.status === "Geschlossen" ? verkaufPreis - kaufPreis : undefined
    };
  } else {
    next = {
      ...next,
      verkaufszeitpunkt: undefined,
      verkaufTransaktionManuell: undefined,
      verkaufGebuehren: undefined,
      verkaufStueckpreis: undefined,
      verkaufPreisManuell: undefined,
      verkaufSteuern: undefined,
      verkaufPreis: undefined,
      gewinn: undefined
    };
  }

  return next;
}

function parseTradeStatus(raw: unknown): Trade["status"] | null {
  const s = String(raw ?? "").trim();
  if (s === "Offen" || s === "Geschlossen") return s;
  return null;
}

const DB_IMPORT_REQUIRED_HEADERS = [
  "legacy_trade_id",
  "kind",
  "booked_at",
  "gross_amount",
  "fees_amount",
  "tax_amount"
] as const;

function rowKeysMatchDbImportHeader(row: Record<string, unknown>): boolean {
  const keys = new Set(Object.keys(row).map((k) => k.trim().toLowerCase()));
  return DB_IMPORT_REQUIRED_HEADERS.every((h) => keys.has(h));
}

function parseSourceBroker(raw: unknown): Trade["sourceBroker"] | undefined {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return undefined;
  if (s === "TRADE_REPUBLIC" || s === "TRADEREPUBLIC") return "TRADE_REPUBLIC";
  if (s === "N26") return "N26";
  if (s === "BAWAG") return "BAWAG";
  if (s === "MANUAL") return "MANUAL";
  return undefined;
}

export type BookingsFullImportErrorKey =
  | "bookingsImportNoSheet"
  | "bookingsImportBadHeader"
  | "bookingsImportBadHeaderDb"
  | "bookingsImportEmptyTradeId"
  | "bookingsImportEmptyLegacyTradeId"
  | "bookingsImportUnknownTrade"
  | "bookingsImportBadKind"
  | "bookingsImportBadDate"
  | "bookingsImportNeedsBuy"
  | "bookingsImportNeedsIncome"
  | "bookingsImportNeedsTax"
  | "bookingsImportKindsMismatch";

export type BookingsImportSuccess = {
  ok: true;
  trades: Trade[];
  updatedTradeCount: number;
  /** Reihenfolge wie in der Excel-Datei (Trades mit mindestens einer importierten Zeile). */
  updatedTradeIds: string[];
  rowCount: number;
};

export type BookingsFullExcelImportResult = BookingsImportSuccess | { ok: false; errorKey: BookingsFullImportErrorKey; vars?: Record<string, string | number> };

export type BookingsImportRunResult = BookingsImportSuccess & { format: "full" | "db" } | Extract<BookingsFullExcelImportResult, { ok: false }>;

/** Voll- oder DB-Import je nach gewähltem Menüpunkt (erwartetes Spaltenlayout). */
export function runBookingsExcelImport(currentTrades: Trade[], workbook: WorkBook, mode: "full" | "db"): BookingsImportRunResult {
  const r = mode === "full" ? applyBookingsFullExcelImport(currentTrades, workbook) : applyBookingsDbExcelImport(currentTrades, workbook);
  if (!r.ok) return r;
  return { ...r, format: mode };
}

function validateKinds(typ: Trade["typ"] | string, kinds: TradePositionBookingKind[]): BookingsFullImportErrorKey | null {
  const set = new Set(kinds);
  if (typ === "Steuerkorrektur") {
    if (kinds.length === 0) return "bookingsImportNeedsTax";
    if (!kinds.every((k) => k === "TAX_CORRECTION")) return "bookingsImportKindsMismatch";
    return null;
  }
  if (typ === "Dividende" || typ === "Zinszahlung") {
    if (kinds.length === 0) return "bookingsImportNeedsIncome";
    if (!kinds.every((k) => k === "INCOME")) return "bookingsImportKindsMismatch";
    return null;
  }
  if (!set.has("BUY")) return "bookingsImportNeedsBuy";
  for (const k of set) {
    if (k !== "BUY" && k !== "SELL") return "bookingsImportKindsMismatch";
  }
  return null;
}

/**
 * Liest ein Workbook im Layout von `exportBookingsFullExcel` (Blatt `Buchungen_Full` oder erstes Blatt)
 * und wendet die Buchungen auf bestehende Trades an (nur bekannte `trade_id`).
 */
export function applyBookingsFullExcelImport(currentTrades: Trade[], workbook: WorkBook): BookingsFullExcelImportResult {
  const preferred = workbook.SheetNames.includes("Buchungen_Full") ? "Buchungen_Full" : workbook.SheetNames[0];
  if (!preferred) {
    return { ok: false, errorKey: "bookingsImportNoSheet" };
  }
  const sheet = workbook.Sheets[preferred];
  if (!sheet) {
    return { ok: false, errorKey: "bookingsImportNoSheet" };
  }
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (json.length === 0) {
    return { ok: false, errorKey: "bookingsImportNoSheet" };
  }
  if (!rowKeysMatchHeader(json[0]!)) {
    return { ok: false, errorKey: "bookingsImportBadHeader" };
  }

  const tradeById = new Map(currentTrades.map((t) => [t.id, t]));
  const orderTradeIds: string[] = [];
  const byTrade = new Map<string, Array<{ row: Record<string, unknown>; excelRow: number }>>();

  for (let i = 0; i < json.length; i++) {
    const row = json[i]!;
    const excelRow = i + 2;
    const tid = String(pick(row, "trade_id") ?? "").trim();
    if (!tid) {
      return { ok: false, errorKey: "bookingsImportEmptyTradeId", vars: { row: excelRow } };
    }
    if (!tradeById.has(tid)) {
      return { ok: false, errorKey: "bookingsImportUnknownTrade", vars: { row: excelRow, id: tid } };
    }
    if (!byTrade.has(tid)) {
      byTrade.set(tid, []);
      orderTradeIds.push(tid);
    }
    byTrade.get(tid)!.push({ row, excelRow });
  }

  const tradeMap = new Map(currentTrades.map((t) => [t.id, { ...t }]));

  for (const tid of orderTradeIds) {
    const rows = byTrade.get(tid)!;
    const base = tradeMap.get(tid)!;
    const kinds: TradePositionBookingKind[] = [];
    const parsedBookings: TradePositionBooking[] = [];

    for (let j = 0; j < rows.length; j++) {
      const { row, excelRow } = rows[j]!;
      const kind = parseBookingKind(pick(row, "booking_kind"));
      if (!kind) {
        return { ok: false, errorKey: "bookingsImportBadKind", vars: { row: excelRow } };
      }
      kinds.push(kind);
      const iso = coerceBookedAtIso(pick(row, "booked_at_iso"));
      if (!iso) {
        return { ok: false, errorKey: "bookingsImportBadDate", vars: { row: excelRow } };
      }
      const dispRaw = String(pick(row, "booked_at_display") ?? "").trim();
      const bookedAtDisplay = dispRaw || formatDateTimeAT(iso) || iso;
      const qty = parseOptionalQty(pick(row, "qty"));
      const unitPrice = parseOptionalQty(pick(row, "unit_price"));
      const b: TradePositionBooking = {
        transactionId: String(pick(row, "transaction_id") ?? "").trim(),
        kind,
        bookedAtIso: iso,
        bookedAtDisplay,
        grossAmount: parseExcelNumber(pick(row, "gross_amount")),
        feesAmount: parseExcelNumber(pick(row, "fees_amount")),
        taxAmount: parseExcelNumber(pick(row, "tax_amount"))
      };
      if (qty !== undefined) b.qty = qty;
      if (unitPrice !== undefined) b.unitPrice = unitPrice;
      parsedBookings.push(b);
    }

    const kindErr = validateKinds(base.typ, kinds);
    if (kindErr) {
      if (kindErr === "bookingsImportNeedsBuy") {
        return { ok: false, errorKey: "bookingsImportNeedsBuy", vars: { id: tid, name: base.name } };
      }
      if (kindErr === "bookingsImportNeedsIncome") {
        return { ok: false, errorKey: "bookingsImportNeedsIncome", vars: { id: tid, name: base.name } };
      }
      if (kindErr === "bookingsImportNeedsTax") {
        return { ok: false, errorKey: "bookingsImportNeedsTax", vars: { id: tid, name: base.name } };
      }
      return { ok: false, errorKey: "bookingsImportKindsMismatch", vars: { id: tid, name: base.name } };
    }

    const first = rows[0]!.row;
    const name = String(pick(first, "trade_name") ?? "").trim();
    const typRaw = String(pick(first, "trade_typ") ?? "").trim();
    const basisRaw = String(pick(first, "basiswert") ?? "").trim();
    const st = parseTradeStatus(pick(first, "trade_status"));

    let meta = base;
    if (name) meta = { ...meta, name };
    if (typRaw) meta = { ...meta, typ: typRaw as Trade["typ"] };
    const noBasis = meta.typ === "Steuerkorrektur" || meta.typ === "Zinszahlung";
    if (basisRaw && !noBasis) {
      meta = { ...meta, basiswert: canonicalizeBasiswert(basisRaw) };
    } else if (noBasis) {
      meta = { ...meta, basiswert: "" };
    }
    if (st) meta = { ...meta, status: st };

    const withLegs = assignLegacyLegs(parsedBookings);
    const synced = syncTradeTopLevelFromBookings(meta, withLegs);
    tradeMap.set(tid, synced);
  }

  const trades = currentTrades.map((t) => tradeMap.get(t.id) ?? t);
  return {
    ok: true,
    trades,
    updatedTradeCount: orderTradeIds.length,
    updatedTradeIds: [...orderTradeIds],
    rowCount: json.length
  };
}

/**
 * Layout wie `exportBookingsDbImportReadyExcel` (Blatt `user_position_transactions` oder erstes Blatt
 * mit Spalten legacy_trade_id, kind, booked_at, …).
 */
export function applyBookingsDbExcelImport(currentTrades: Trade[], workbook: WorkBook): BookingsFullExcelImportResult {
  const preferred = workbook.SheetNames.includes("user_position_transactions")
    ? "user_position_transactions"
    : workbook.SheetNames[0];
  if (!preferred) {
    return { ok: false, errorKey: "bookingsImportNoSheet" };
  }
  const sheet = workbook.Sheets[preferred];
  if (!sheet) {
    return { ok: false, errorKey: "bookingsImportNoSheet" };
  }
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (json.length === 0) {
    return { ok: false, errorKey: "bookingsImportNoSheet" };
  }
  if (!rowKeysMatchDbImportHeader(json[0]!)) {
    return { ok: false, errorKey: "bookingsImportBadHeaderDb" };
  }

  const tradeById = new Map(currentTrades.map((t) => [t.id, t]));
  const orderTradeIds: string[] = [];
  const byTrade = new Map<string, Array<{ row: Record<string, unknown>; excelRow: number }>>();

  for (let i = 0; i < json.length; i++) {
    const row = json[i]!;
    const excelRow = i + 2;
    const tid = String(pick(row, "legacy_trade_id") ?? "").trim();
    if (!tid) {
      return { ok: false, errorKey: "bookingsImportEmptyLegacyTradeId", vars: { row: excelRow } };
    }
    if (!tradeById.has(tid)) {
      return { ok: false, errorKey: "bookingsImportUnknownTrade", vars: { row: excelRow, id: tid } };
    }
    if (!byTrade.has(tid)) {
      byTrade.set(tid, []);
      orderTradeIds.push(tid);
    }
    byTrade.get(tid)!.push({ row, excelRow });
  }

  const tradeMap = new Map(currentTrades.map((t) => [t.id, { ...t }]));

  for (const tid of orderTradeIds) {
    const rows = byTrade.get(tid)!;
    const base = tradeMap.get(tid)!;
    const kinds: TradePositionBookingKind[] = [];
    const parsedBookings: TradePositionBooking[] = [];

    for (let j = 0; j < rows.length; j++) {
      const { row, excelRow } = rows[j]!;
      const kind = parseBookingKind(pick(row, "kind"));
      if (!kind) {
        return { ok: false, errorKey: "bookingsImportBadKind", vars: { row: excelRow } };
      }
      kinds.push(kind);
      const iso = coerceBookedAtIso(pick(row, "booked_at"));
      if (!iso) {
        return { ok: false, errorKey: "bookingsImportBadDate", vars: { row: excelRow } };
      }
      const bookedAtDisplay = formatDateTimeAT(iso) || iso;
      const qty = parseOptionalQty(pick(row, "qty"));
      const unitPrice = parseOptionalQty(pick(row, "unit_price"));
      const b: TradePositionBooking = {
        transactionId: String(pick(row, "external_transaction_id") ?? "").trim(),
        kind,
        bookedAtIso: iso,
        bookedAtDisplay,
        grossAmount: parseExcelNumber(pick(row, "gross_amount")),
        feesAmount: parseExcelNumber(pick(row, "fees_amount")),
        taxAmount: parseExcelNumber(pick(row, "tax_amount"))
      };
      if (qty !== undefined) b.qty = qty;
      if (unitPrice !== undefined) b.unitPrice = unitPrice;
      parsedBookings.push(b);
    }

    const kindErr = validateKinds(base.typ, kinds);
    if (kindErr) {
      if (kindErr === "bookingsImportNeedsBuy") {
        return { ok: false, errorKey: "bookingsImportNeedsBuy", vars: { id: tid, name: base.name } };
      }
      if (kindErr === "bookingsImportNeedsIncome") {
        return { ok: false, errorKey: "bookingsImportNeedsIncome", vars: { id: tid, name: base.name } };
      }
      if (kindErr === "bookingsImportNeedsTax") {
        return { ok: false, errorKey: "bookingsImportNeedsTax", vars: { id: tid, name: base.name } };
      }
      return { ok: false, errorKey: "bookingsImportKindsMismatch", vars: { id: tid, name: base.name } };
    }

    const first = rows[0]!.row;
    let meta = base;
    const broker = parseSourceBroker(pick(first, "source_broker"));
    if (broker) meta = { ...meta, sourceBroker: broker };
    const account = String(pick(first, "source_account") ?? "").trim();
    if (account) meta = { ...meta, sourceAccount: account };

    const withLegs = assignLegacyLegs(parsedBookings);
    const synced = syncTradeTopLevelFromBookings(meta, withLegs);
    tradeMap.set(tid, synced);
  }

  const trades = currentTrades.map((t) => tradeMap.get(t.id) ?? t);
  return {
    ok: true,
    trades,
    updatedTradeCount: orderTradeIds.length,
    updatedTradeIds: [...orderTradeIds],
    rowCount: json.length
  };
}
