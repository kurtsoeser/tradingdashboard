import type { AppSettings } from "../app/settings";
import type { AssetMeta } from "../app/types";
import type { JournalData } from "./journalStorage";
import { supabase } from "./supabaseClient";
import { assignLegacyLegs, syntheticBookingsFromTrade } from "./bookingsDraft";
import type { Trade, TradePositionBooking, TradePositionBookingKind } from "../types/trade";
import { formatDateTimeAT, parseStoredDateTime, toDisplayDateTime } from "../app/date";

/** Read-only: erwartete vs. gespeicherte Buchungszeilen loggen (Diagnose). */
const ENABLE_POSITIONS_READONLY_PARITY_CHECK = true;
const ENABLE_POSITIONS_DUAL_WRITE = true;

const CASHFLOW_TRADE_TYPES = new Set<string>(["Steuerkorrektur", "Dividende", "Zinszahlung"]);

/**
 * Verhindert DELETE+INSERT mit fachlich leeren BUY/SELL-Beträgen (z. B. fehlende grossAmount in `bookings`,
 * während der Trade noch Preisfelder > 0 hat) — sonst würden echte Supabase-Zeilen durch Nullen ersetzt.
 */
function dualWriteSnapshotWouldZeroOutRealMoney(trades: Trade[]): boolean {
  for (const trade of trades) {
    if (CASHFLOW_TRADE_TYPES.has(String(trade.typ))) continue;
    const rows =
      trade.bookings && trade.bookings.length > 0 ? trade.bookings : syntheticBookingsFromTrade(trade);
    let anyBuySellQty = false;
    let anyBuySellMoney = false;
    for (const b of rows) {
      if (b.kind !== "BUY" && b.kind !== "SELL") continue;
      const qty = Number(b.qty ?? 0);
      const gross = Number(b.grossAmount ?? 0);
      const unit = Number(b.unitPrice ?? 0);
      if (Number.isFinite(qty) && qty > 1e-9) anyBuySellQty = true;
      if (Number.isFinite(gross) && Math.abs(gross) > 1e-6) anyBuySellMoney = true;
      if (Number.isFinite(unit) && Math.abs(unit) > 1e-9) anyBuySellMoney = true;
    }
    if (!anyBuySellQty || anyBuySellMoney) continue;
    const kauf = Number(trade.kaufPreis ?? 0);
    const verkauf = Number(trade.verkaufPreis ?? 0);
    const kaufTx = Number(trade.kaufTransaktionManuell ?? 0);
    const verkaufTx = Number(trade.verkaufTransaktionManuell ?? 0);
    if (
      (Number.isFinite(kauf) && kauf > 0.01) ||
      (Number.isFinite(verkauf) && verkauf > 0.01) ||
      (Number.isFinite(kaufTx) && kaufTx > 0.01) ||
      (Number.isFinite(verkaufTx) && verkaufTx > 0.01)
    ) {
      return true;
    }
  }
  return false;
}

export interface CloudSnapshot {
  trades: Trade[];
  assetMeta: AssetMeta[];
  journalData: JournalData;
  aiKnowledgeBase: string;
  appSettings: AppSettings;
  theme: "dark" | "light";
}

function emptySnapshot(): CloudSnapshot {
  return {
    trades: [],
    assetMeta: [],
    journalData: { byDay: {}, byWeek: {}, byMonth: {} },
    aiKnowledgeBase: "",
    appSettings: {} as AppSettings,
    theme: "dark"
  };
}

function toNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function fromNullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

interface DbPositionRow {
  position_id: string;
  legacy_trade_id?: string | null;
  manual_checked?: boolean | null;
  source_broker?: string | null;
  source_account?: string | null;
  name: string;
  typ: string;
  basiswert: string;
  isin: string | null;
  wkn: string | null;
  notiz: string | null;
  opened_at: string;
  closed_at: string | null;
  status: "OPEN" | "CLOSED";
}

interface DbPositionTxRow {
  position_id: string;
  source_broker?: string | null;
  source_account?: string | null;
  external_transaction_id?: string | null;
  kind: "BUY" | "SELL" | "TAX_CORRECTION" | "INCOME";
  booked_at: string;
  qty: number | null;
  unit_price: number | null;
  gross_amount: number;
  fees_amount: number;
  tax_amount: number;
}

type TxRowPayload = Record<string, unknown>;

function txRowConflictKey(row: TxRowPayload): string {
  return `${String(row.user_id ?? "")}::${String(row.legacy_trade_id ?? "")}::${String(row.legacy_leg ?? "")}`;
}

function normalizeExternalTransactionId(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * PostgREST upsert (onConflict) wirft 409, wenn derselbe Konflikt-Schlüssel innerhalb EINER
 * Request-Payload mehrfach vorkommt ("cannot affect row a second time").
 * Deshalb deduplizieren wir vor dem Upsert strikt nach (user_id, legacy_trade_id, legacy_leg).
 */
function dedupeTxRowsByConflictKey(rows: TxRowPayload[]): TxRowPayload[] {
  const byKey = new Map<string, TxRowPayload>();
  for (const row of rows) {
    const key = txRowConflictKey(row);
    if (!key || key === "::") continue;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

function txExternalUniqueKey(row: TxRowPayload): string {
  return `${String(row.user_id ?? "")}::${String(row.source_broker ?? "")}::${String(row.external_transaction_id ?? "")}`;
}

function isExternalIdUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "");
  const details = String(e.details ?? "");
  const haystack = `${message} ${details}`.toLowerCase();
  return code === "23505" && haystack.includes("user_position_transactions_external_id_unique");
}

/** DB-Zeit (ISO) oder Legacy-Anzeige → einheitliches Anzeigeformat für die App. */
function toAppDisplayDateTime(raw: string | undefined | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  const parsed = parseStoredDateTime(s);
  if (!parsed) {
    // Kein `new Date(s)` — gleiche US/EU-Fallen wie bei `05.01.2026` (Browser interpretiert als Mai).
    return s;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2}\s+\d/.test(s)) {
    return toDisplayDateTime(s);
  }
  return s;
}

function kaufzeitSortKey(t: Trade): number {
  const parsed = parseStoredDateTime(t.kaufzeitpunkt);
  return parsed ? parsed.getTime() : 0;
}

function isLegacyStyleTradeId(id: string): boolean {
  return id.startsWith("trade-") || id.startsWith("aktie-") || id.startsWith("bawag-");
}

/** Fingerabdruck für fachlich identische Zeilen (z. B. `trade-…` und UUID parallel). */
function fingerprintTrade(t: Trade): string {
  if (t.typ === "Steuerkorrektur") {
    return `Steuerkorrektur\t${String(t.kaufzeitpunkt ?? "").trim()}\t${Number(t.verkaufSteuern ?? 0)}\t${String(t.name ?? "").trim().toLowerCase()}`;
  }
  if (t.typ === "Dividende" || t.typ === "Zinszahlung") {
    return `${t.typ}\t${String(t.name ?? "").trim().toLowerCase()}\t${String(t.kaufzeitpunkt ?? "").trim()}\t${String(t.verkaufszeitpunkt ?? "").trim()}\t${Number(t.verkaufPreis ?? t.kaufPreis)}`;
  }
  return [
    t.typ,
    (t.basiswert ?? "").trim().toLowerCase(),
    String(t.kaufzeitpunkt ?? "").trim(),
    t.status,
    Number(t.kaufPreis).toFixed(4),
    String(t.verkaufszeitpunkt ?? "").trim(),
    Number(t.verkaufPreis ?? 0).toFixed(4),
    String(t.name ?? "").trim().toLowerCase()
  ].join("\t");
}

function pickPreferredDuplicateTrade(a: Trade, b: Trade): Trade {
  const la = isLegacyStyleTradeId(a.id);
  const lb = isLegacyStyleTradeId(b.id);
  if (la && !lb) return a;
  if (!la && lb) return b;
  return a.id.localeCompare(b.id) <= 0 ? a : b;
}

/**
 * Entfernt doppelte fachliche Trades (unterschiedliche `trade_id`, gleicher Fingerabdruck).
 * Bevorzugt `trade-*` / `aktie-*` / `bawag-*` gegenüber UUIDs.
 */
function dedupeTradesFromDb(trades: Trade[]): Trade[] {
  const byFp = new Map<string, Trade>();
  for (const t of trades) {
    const key = fingerprintTrade(t);
    const prev = byFp.get(key);
    if (!prev) {
      byFp.set(key, t);
      continue;
    }
    byFp.set(key, pickPreferredDuplicateTrade(prev, t));
  }
  const out = [...byFp.values()].sort((a, b) => kaufzeitSortKey(b) - kaufzeitSortKey(a));
  if (out.length < trades.length) {
    console.warn(
      `[cloudStorage] ${trades.length - out.length} doppelte Trade-Zeile(n) zusammengeführt (Legacy-ID bevorzugt, gleicher Fingerabdruck).`
    );
  }
  return out;
}

function fromDbPositionsSnapshot(positions: DbPositionRow[], txRows: DbPositionTxRow[], legacyByTradeId: Map<string, Trade>): Trade[] {
  const txByPosition = new Map<string, DbPositionTxRow[]>();
  for (const tx of txRows) {
    const list = txByPosition.get(tx.position_id) ?? [];
    list.push(tx);
    txByPosition.set(tx.position_id, list);
  }

  return positions
    .map((position): Trade => {
      const legacyId = position.legacy_trade_id?.trim() ?? "";
      /** Immer dieselbe ID wie beim Dual-Write (`legacy_trade_id`), nie nur `position_id` — sonst entstehen neue DB-Zeilen pro Speichern. */
      const stableTradeId = legacyId || position.position_id;
      const legacy = legacyId ? legacyByTradeId.get(legacyId) : undefined;
      if (legacy) {
        const posNotiz = position.notiz?.trim();
        const next = posNotiz ? { ...legacy, notiz: posNotiz } : { ...legacy };
        return {
          ...next,
          sourceBroker: (position.source_broker as Trade["sourceBroker"]) ?? next.sourceBroker,
          sourceAccount: position.source_account ?? next.sourceAccount
        };
      }

      const tx = txByPosition.get(position.position_id) ?? [];
      const buyRows = tx.filter((row) => row.kind === "BUY");
      const sellRows = tx.filter((row) => row.kind === "SELL");
      const taxRows = tx.filter((row) => row.kind === "TAX_CORRECTION");

      if (position.typ === "Dividende" || position.typ === "Zinszahlung") {
        const incomeRows = tx.filter((row) => row.kind === "INCOME");
        const inc = incomeRows[0];
        const gross = inc ? Number(inc.gross_amount ?? 0) : 0;
        const taxAmt = inc ? Number(inc.tax_amount ?? 0) : 0;
        // App-Konvention: Steuerzahlung negativ, Erstattung positiv.
        const taxCashflow = taxAmt > 0 ? -taxAmt : taxAmt;
        const bookedRaw = inc?.booked_at ?? position.opened_at;
        return {
          id: stableTradeId,
          manualChecked: !!position.manual_checked,
          sourceBroker: (position.source_broker as Trade["sourceBroker"]) ?? "MANUAL",
          sourceAccount: position.source_account ?? undefined,
          name: position.name,
          typ: position.typ as Trade["typ"],
          basiswert: position.basiswert ?? "",
          isin: fromNullable(position.isin),
          wkn: fromNullable(position.wkn),
          notiz: fromNullable(position.notiz),
          kaufzeitpunkt: toAppDisplayDateTime(bookedRaw),
          kaufPreis: 0,
          verkaufTransaktionManuell: gross > 0 ? gross : undefined,
          verkaufSteuern: taxCashflow,
          verkaufPreis: gross + taxCashflow,
          status: "Geschlossen"
        };
      }

      const buyQty = buyRows.reduce((sum, row) => sum + (row.qty ?? 0), 0);
      const buyGross = buyRows.reduce((sum, row) => sum + row.gross_amount, 0);
      const buyFees = buyRows.reduce((sum, row) => sum + row.fees_amount, 0);
      const sellQty = sellRows.reduce((sum, row) => sum + (row.qty ?? 0), 0);
      const sellGross = sellRows.reduce((sum, row) => sum + row.gross_amount, 0);
      const sellFees = sellRows.reduce((sum, row) => sum + row.fees_amount, 0);
      const sellTaxes = sellRows.reduce((sum, row) => sum + row.tax_amount, 0);
      const taxCorrections = taxRows.reduce((sum, row) => sum + row.tax_amount, 0);
      const latestSell = sellRows
        .map((row) => row.booked_at)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      if (position.typ === "Steuerkorrektur") {
        return {
          id: stableTradeId,
          manualChecked: !!position.manual_checked,
          sourceBroker: (position.source_broker as Trade["sourceBroker"]) ?? "MANUAL",
          sourceAccount: position.source_account ?? undefined,
          name: position.name,
          typ: "Steuerkorrektur",
          basiswert: "",
          isin: fromNullable(position.isin),
          wkn: fromNullable(position.wkn),
          notiz: fromNullable(position.notiz),
          kaufzeitpunkt: toAppDisplayDateTime(position.opened_at),
          kaufPreis: 0,
          verkaufSteuern: taxCorrections,
          status: "Geschlossen"
        };
      }

      const closed = position.status === "CLOSED";
      const buyPrice = buyGross + buyFees;
      const sellProceeds = sellGross - sellFees;
      // SELL.tax_amount ist in DB >= 0 (Steuerlast).
      // Für die App gilt: Steuerlast als negativer Cashflow.
      // TAX_CORRECTION bleibt mit Vorzeichen aus DB erhalten (+ Erstattung / - Nachzahlung).
      const tradeTaxCashflow = -sellTaxes + taxCorrections;
      const sellTotal = closed ? sellProceeds + tradeTaxCashflow : undefined;
      const qty = buyQty > 0 ? (closed ? buyQty : Math.max(0, buyQty - sellQty)) : undefined;

      return {
        id: stableTradeId,
        manualChecked: !!position.manual_checked,
        sourceBroker: (position.source_broker as Trade["sourceBroker"]) ?? "MANUAL",
        sourceAccount: position.source_account ?? undefined,
        name: position.name,
        typ: position.typ,
        basiswert: position.basiswert,
        isin: fromNullable(position.isin),
        wkn: fromNullable(position.wkn),
        notiz: fromNullable(position.notiz),
        kaufzeitpunkt: toAppDisplayDateTime(position.opened_at),
        kaufPreis: buyPrice,
        stueck: qty,
        kaufStueckpreis: buyQty > 0 ? buyGross / buyQty : undefined,
        kaufTransaktionManuell: buyGross > 0 ? buyGross : undefined,
        kaufGebuehren: buyFees > 0 ? buyFees : undefined,
        verkaufszeitpunkt: closed ? toAppDisplayDateTime(latestSell ?? position.closed_at) : undefined,
        verkaufPreis: sellTotal,
        verkaufStueckpreis: closed && sellQty > 0 ? sellGross / sellQty : undefined,
        verkaufTransaktionManuell: closed && sellGross > 0 ? sellGross : undefined,
        verkaufSteuern: closed ? tradeTaxCashflow : undefined,
        verkaufGebuehren: closed && sellFees > 0 ? sellFees : undefined,
        gewinn: closed && sellTotal !== undefined ? sellTotal - buyPrice : undefined,
        status: closed ? "Geschlossen" : "Offen"
      };
    })
    .sort((a, b) => kaufzeitSortKey(b) - kaufzeitSortKey(a));
}

/**
 * Gleiche Semantik wie in der App-Anzeige: zuerst {@link parseStoredDateTime} (de-AT, ISO, US-Datum),
 * damit Dual-Write nicht mit `now()` falsche Handelszeitpunkte erzeugt.
 * Leerer Wert → aktueller Zeitpunkt (NOT NULL-Spalten). Unparsbar → 1970-01-01 UTC + Warnung.
 */
function parseLegacyDateToIso(value?: string, logContext?: string): string {
  const raw = value?.trim();
  if (!raw) return new Date().toISOString();

  const fromApp = parseStoredDateTime(raw);
  if (fromApp) return fromApp.toISOString();

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();

  console.warn("[cloudStorage] parseLegacyDateToIso: Datum nicht parsebar, Fallback 1970-01-01 UTC", {
    value: raw,
    context: logContext
  });
  return new Date(0).toISOString();
}

function toBookingKind(raw: string): TradePositionBookingKind | null {
  if (raw === "BUY" || raw === "SELL" || raw === "TAX_CORRECTION" || raw === "INCOME") return raw;
  return null;
}

function bookedAtRawToIso(raw: string): string {
  const p = parseStoredDateTime(raw);
  if (p) return p.toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function txRowToBooking(row: Record<string, unknown>): TradePositionBooking | null {
  const kind = toBookingKind(String(row.kind ?? ""));
  if (!kind) return null;
  const bookedRaw = String(row.booked_at ?? "");
  const qtyRaw = row.qty;
  const unitRaw = row.unit_price;
  const qty = qtyRaw === null || qtyRaw === undefined || String(qtyRaw).trim() === "" ? undefined : Number(qtyRaw);
  const unitPrice =
    unitRaw === null || unitRaw === undefined || String(unitRaw).trim() === "" ? undefined : Number(unitRaw);
  return {
    transactionId: String(row.transaction_id ?? ""),
    kind,
    bookedAtIso: bookedAtRawToIso(bookedRaw),
    bookedAtDisplay: formatDateTimeAT(bookedRaw) || bookedRaw || "—",
    qty: qty !== undefined && Number.isFinite(qty) ? qty : undefined,
    unitPrice: unitPrice !== undefined && Number.isFinite(unitPrice) ? unitPrice : undefined,
    grossAmount: Number(row.gross_amount ?? 0) || 0,
    feesAmount: Number(row.fees_amount ?? 0) || 0,
    taxAmount: Number(row.tax_amount ?? 0) || 0,
    legacyLeg: String(row.legacy_leg ?? "") || undefined
  };
}

/** Hängt Cloud-Buchungen an Trades (nach `legacy_trade_id`), wenn Transaktionen geladen wurden. */
function attachPositionBookingsFromSupabase(
  trades: Trade[],
  txRows: Array<Record<string, unknown>>
): Trade[] {
  const byLegacy = new Map<string, Array<Record<string, unknown>>>();
  for (const row of txRows) {
    const lid = String(row.legacy_trade_id ?? "").trim();
    if (!lid) continue;
    const list = byLegacy.get(lid) ?? [];
    list.push(row);
    byLegacy.set(lid, list);
  }

  return trades.map((trade) => {
    const rows = byLegacy.get(trade.id);
    if (!rows?.length) {
      if (!trade.bookings?.length) return trade;
      const { bookings: _b, ...rest } = trade;
      return rest as Trade;
    }
    const sortedRows = [...rows].sort((a, b) => {
      const da = parseStoredDateTime(String(a.booked_at ?? ""));
      const db = parseStoredDateTime(String(b.booked_at ?? ""));
      return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
    });
    const bookings = sortedRows.map((r) => txRowToBooking(r)).filter((b): b is TradePositionBooking => Boolean(b));
    return { ...trade, bookings };
  });
}

async function loadLegacySnapshot(userId: string): Promise<CloudSnapshot | null> {
  const { data, error } = await supabase!
    .from("user_app_data")
    .select("snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  if (!data?.snapshot) return null;
  return data.snapshot as CloudSnapshot;
}

export async function loadCloudSnapshot(userId: string): Promise<CloudSnapshot | null> {
  if (!supabase) return null;

  const [positionsRes, txRes, assetsRes, journalRes, settingsRes, aiRes] = await Promise.all([
    supabase.from("user_positions").select("*").eq("user_id", userId).order("opened_at", { ascending: false }),
    supabase.from("user_position_transactions").select("*").eq("user_id", userId).order("booked_at", { ascending: true }),
    supabase.from("user_asset_meta").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("user_journal_entries").select("*").eq("user_id", userId),
    supabase.from("user_settings").select("settings,theme").eq("user_id", userId).maybeSingle(),
    supabase.from("user_ai_knowledge").select("content").eq("user_id", userId).maybeSingle()
  ]);

  if (positionsRes.error) {
    console.warn("user_positions konnte nicht geladen werden (Legacy bleibt aktiv):", positionsRes.error.message);
  }
  if (txRes.error) {
    console.warn("user_position_transactions konnte nicht geladen werden (Legacy bleibt aktiv):", txRes.error.message);
  }
  if (assetsRes.error) throw assetsRes.error;
  if (journalRes.error) throw journalRes.error;
  if (settingsRes.error) throw settingsRes.error;
  if (aiRes.error) throw aiRes.error;

  const hasNormalizedData =
    (!positionsRes.error && (positionsRes.data?.length ?? 0) > 0) ||
    (!txRes.error && (txRes.data?.length ?? 0) > 0) ||
    (assetsRes.data?.length ?? 0) > 0 ||
    (journalRes.data?.length ?? 0) > 0 ||
    Boolean(settingsRes.data) ||
    Boolean(aiRes.data?.content);

  if (!hasNormalizedData) {
    const legacy = await loadLegacySnapshot(userId);
    if (legacy) {
      await saveCloudSnapshot(userId, legacy);
      return legacy;
    }
    return null;
  }

  const snapshot = emptySnapshot();
  const legacyById = new Map<string, Trade>();
  const positionsRows = (!positionsRes.error ? positionsRes.data : []) ?? [];
  const txRowsSafe = (!txRes.error ? txRes.data : []) ?? [];
  const positionsTrades = fromDbPositionsSnapshot(positionsRows as DbPositionRow[], txRowsSafe as DbPositionTxRow[], legacyById);
  snapshot.trades = [...positionsTrades].sort((a, b) => kaufzeitSortKey(b) - kaufzeitSortKey(a));
  if (!txRes.error && txRowsSafe.length > 0) {
    try {
      snapshot.trades = attachPositionBookingsFromSupabase(snapshot.trades, txRowsSafe as Record<string, unknown>[]);
    } catch (e) {
      console.warn("[cloudStorage] Buchungen an Trades anhängen fehlgeschlagen:", e);
    }
  }
  snapshot.trades = dedupeTradesFromDb(snapshot.trades);
  snapshot.assetMeta = (assetsRes.data ?? []).map((row) => ({
    name: String(row.name),
    category: fromNullable((row.category as string | null) ?? null),
    ticker: fromNullable((row.ticker as string | null) ?? null),
    isin: fromNullable((row.isin as string | null) ?? null),
    wkn: fromNullable((row.wkn as string | null) ?? null),
    waehrung: fromNullable((row.waehrung as string | null) ?? null)
  }));
  for (const row of journalRes.data ?? []) {
    const scope = String(row.scope);
    const entryKey = String(row.entry_key);
    const content = String(row.content ?? "");
    if (scope === "day") snapshot.journalData.byDay[entryKey] = content;
    if (scope === "week") snapshot.journalData.byWeek[entryKey] = content;
    if (scope === "month") snapshot.journalData.byMonth[entryKey] = content;
  }
  snapshot.appSettings = ((settingsRes.data?.settings ?? {}) as AppSettings);
  snapshot.theme = settingsRes.data?.theme === "light" ? "light" : "dark";
  snapshot.aiKnowledgeBase = String(aiRes.data?.content ?? "");

  if (ENABLE_POSITIONS_READONLY_PARITY_CHECK) {
    void runPositionsParityCheck(userId, snapshot.trades);
  }

  return snapshot;
}

/** Erwartete Tx-Zeilen aus `trade.bookings` (Fallback: synthetische Buchungen). */
function expectedBookingTxCounts(trades: Trade[]): { buy: number; sell: number; tax: number; income: number; positions: number } {
  let buy = 0;
  let sell = 0;
  let tax = 0;
  let income = 0;
  for (const t of trades) {
    if (t.typ === "Dividende" || t.typ === "Zinszahlung") {
      const n = t.bookings?.filter((b) => b.kind === "INCOME").length ?? 0;
      income += n > 0 ? n : 1;
      continue;
    }
    if (t.typ === "Steuerkorrektur") {
      const n = t.bookings?.filter((b) => b.kind === "TAX_CORRECTION").length ?? 0;
      tax += n > 0 ? n : 1;
      continue;
    }
    const buyN = t.bookings?.filter((b) => b.kind === "BUY").length ?? 0;
    buy += buyN > 0 ? buyN : 1;
    if (t.status === "Geschlossen") {
      const sellN = t.bookings?.filter((b) => b.kind === "SELL").length ?? 0;
      sell += sellN > 0 ? sellN : 1;
    }
  }
  return { buy, sell, tax, income, positions: trades.length };
}

async function runPositionsParityCheck(userId: string, tradesForParity: Trade[]): Promise<void> {
  if (!supabase) return;
  try {
    const [positionsRes, txRes] = await Promise.all([
      supabase.from("user_positions").select("position_id,typ,status,legacy_trade_id").eq("user_id", userId),
      supabase.from("user_position_transactions").select("kind,legacy_trade_id").eq("user_id", userId)
    ]);
    if (positionsRes.error || txRes.error) return;

    const positions = positionsRes.data ?? [];
    const tx = txRes.data ?? [];

    const tradeIds = new Set(tradesForParity.map((t) => t.id));

    const positionsInScope = positions.filter((p) => {
      const lid = String((p as Record<string, unknown>).legacy_trade_id ?? "").trim();
      return lid.length > 0 && tradeIds.has(lid);
    });
    const txInScope = tx.filter((row) => {
      const lid = String((row as Record<string, unknown>).legacy_trade_id ?? "").trim();
      return lid.length > 0 && tradeIds.has(lid);
    });

    const txCountByKind = txInScope.reduce<Record<string, number>>((acc, row) => {
      const kind = String((row as Record<string, unknown>).kind ?? "");
      if (!kind) return acc;
      acc[kind] = (acc[kind] ?? 0) + 1;
      return acc;
    }, {});

    const exp = expectedBookingTxCounts(tradesForParity);
    const expectedPositions = exp.positions;
    const expectedTax = exp.tax;
    const expectedBuy = exp.buy;
    const expectedSell = exp.sell;
    const expectedIncome = exp.income;

    const currentPositions = positionsInScope.length;
    const currentBuy = txCountByKind.BUY ?? 0;
    const currentSell = txCountByKind.SELL ?? 0;
    const currentTax = txCountByKind.TAX_CORRECTION ?? 0;
    const currentIncome = txCountByKind.INCOME ?? 0;

    const hasAnyPositionsData = positions.length > 0 || tx.length > 0;
    if (!hasAnyPositionsData) return;

    const parityOk =
      expectedPositions === currentPositions &&
      expectedBuy === currentBuy &&
      expectedSell === currentSell &&
      expectedTax === currentTax &&
      expectedIncome === currentIncome;

    const payload = {
      expected: {
        positions: expectedPositions,
        buy: expectedBuy,
        sell: expectedSell,
        taxCorrection: expectedTax,
        income: expectedIncome
      },
      current: {
        positions: currentPositions,
        buy: currentBuy,
        sell: currentSell,
        taxCorrection: currentTax,
        income: currentIncome
      },
      rawDbRows: { positions: positions.length, transactions: tx.length }
    };

    if (parityOk) {
      console.debug("Positions parity check OK", payload);
    } else {
      console.info(
        "Positions parity mismatch (nur Zeilen mit legacy_trade_id zu geladenen Trades; rawDbRows = gesamte DB-Zeilen)",
        payload
      );
    }
  } catch {
    // Read-only diagnostics must never break normal loading.
  }
}

export async function saveCloudSnapshot(userId: string, snapshot: CloudSnapshot): Promise<void> {
  if (!supabase) return;
  const tradesForPersist = dedupeTradesFromDb(snapshot.trades);
  const assetRows = snapshot.assetMeta.map((meta) => ({
    user_id: userId,
    name: meta.name,
    category: toNullable(meta.category),
    ticker: toNullable(meta.ticker),
    isin: toNullable(meta.isin),
    wkn: toNullable(meta.wkn),
    waehrung: toNullable(meta.waehrung)
  }));
  const journalRows = [
    ...Object.entries(snapshot.journalData.byDay).map(([entry_key, content]) => ({ user_id: userId, scope: "day", entry_key, content })),
    ...Object.entries(snapshot.journalData.byWeek).map(([entry_key, content]) => ({ user_id: userId, scope: "week", entry_key, content })),
    ...Object.entries(snapshot.journalData.byMonth).map(([entry_key, content]) => ({ user_id: userId, scope: "month", entry_key, content }))
  ];

  const { error: delAssetsError } = await supabase.from("user_asset_meta").delete().eq("user_id", userId);
  if (delAssetsError) throw delAssetsError;
  if (assetRows.length > 0) {
    const { error } = await supabase.from("user_asset_meta").insert(assetRows);
    if (error) throw error;
  }

  const { error: delJournalError } = await supabase.from("user_journal_entries").delete().eq("user_id", userId);
  if (delJournalError) throw delJournalError;
  if (journalRows.length > 0) {
    const { error } = await supabase.from("user_journal_entries").insert(journalRows);
    if (error) throw error;
  }

  const { error: settingsError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      settings: snapshot.appSettings,
      theme: snapshot.theme
    },
    { onConflict: "user_id" }
  );
  if (settingsError) throw settingsError;

  const { error: aiError } = await supabase.from("user_ai_knowledge").upsert(
    {
      user_id: userId,
      content: snapshot.aiKnowledgeBase
    },
    { onConflict: "user_id" }
  );
  if (aiError) throw aiError;

  if (ENABLE_POSITIONS_DUAL_WRITE) {
    await savePositionsDualWrite(userId, tradesForPersist);
  }
}

function buildTxRowsForTrade(userId: string, trade: Trade, positionId: string): Array<Record<string, unknown>> {
  const note = "App bookings sync";
  const hasExplicitBookings = Array.isArray(trade.bookings) && trade.bookings.length > 0;
  const sourceRows = hasExplicitBookings ? trade.bookings! : [];

  // Wichtiger Safety-Guard:
  // Für normale BUY/SELL-Trades niemals aus synthetischen Defaults (qty=1, gross=0) schreiben.
  // Sonst würden reale DB-Transaktionen mit 1/0 überschrieben.
  if (!hasExplicitBookings && trade.typ !== "Steuerkorrektur" && trade.typ !== "Dividende" && trade.typ !== "Zinszahlung") {
    return [];
  }

  if (trade.typ === "Steuerkorrektur") {
    const taxOnly = sourceRows.filter((b) => b.kind === "TAX_CORRECTION");
    const taxLegs = assignLegacyLegs(taxOnly.length > 0 ? taxOnly : syntheticBookingsFromTrade(trade));
    return taxLegs.map((b) => ({
      user_id: userId,
      source_broker: trade.sourceBroker ?? "MANUAL",
      source_account: toNullable(trade.sourceAccount),
      position_id: positionId,
      kind: "TAX_CORRECTION",
      booked_at: parseLegacyDateToIso(b.bookedAtIso || b.bookedAtDisplay, `tx.TAX_CORRECTION legacy=${trade.id}`),
      qty: null,
      unit_price: null,
      gross_amount: 0,
      fees_amount: 0,
      tax_amount: Number.isFinite(Number(b.taxAmount)) ? Number(b.taxAmount) : 0,
      tax_mode: "MANUAL",
      note,
      legacy_trade_id: trade.id,
      legacy_leg: b.legacyLeg ?? "TAX_CORRECTION",
      // Für Tx-Unique-Key nur echte Ereignis-ID der jeweiligen Buchung verwenden.
      // Trade-weite Fallback-ID würde bei mehreren Legs (BUY/SELL) zu 23505 führen.
      external_transaction_id: normalizeExternalTransactionId(b.transactionId)
    }));
  }

  const legs = assignLegacyLegs(sourceRows);
  // Auto-Repair:
  // Für normale Trades (BUY/SELL) den Trade-Steuerwert auf SELL-Legs zurückspiegeln.
  // So werden ältere, inkonsistente booking.taxAmount-Werte beim nächsten Speichern
  // automatisch bereinigt (ohne manuelle Einzelkorrektur im UI).
  let repairedLegs = legs;
  if (trade.typ !== "Steuerkorrektur" && trade.typ !== "Dividende" && trade.typ !== "Zinszahlung") {
    const sellIdx: number[] = [];
    for (let i = 0; i < repairedLegs.length; i++) {
      if (repairedLegs[i].kind === "SELL") sellIdx.push(i);
    }
    if (sellIdx.length > 0) {
      const desiredSellTaxTotal = Math.max(0, Math.abs(Number(trade.verkaufSteuern ?? 0)));
      let currentOtherSellTaxes = 0;
      for (let i = 0; i < sellIdx.length - 1; i++) {
        currentOtherSellTaxes += Math.max(0, Number(repairedLegs[sellIdx[i]].taxAmount ?? 0));
      }
      const lastSellIdx = sellIdx[sellIdx.length - 1]!;
      const nextLastSellTax = Math.max(0, desiredSellTaxTotal - currentOtherSellTaxes);
      repairedLegs = repairedLegs.map((row, idx) => (idx === lastSellIdx ? { ...row, taxAmount: nextLastSellTax } : row));
    }
  }
  return repairedLegs.map((b) => {
    const kind = b.kind;
    const qtyRaw = kind === "TAX_CORRECTION" || kind === "INCOME" ? null : b.qty ?? null;
    const unitRaw = kind === "TAX_CORRECTION" || kind === "INCOME" ? null : b.unitPrice ?? null;
    const qtyN = qtyRaw === null || qtyRaw === undefined ? NaN : Number(qtyRaw);
    const unitN = unitRaw === null || unitRaw === undefined ? NaN : Number(unitRaw);
    let grossN = Number(b.grossAmount ?? NaN);
    if ((kind === "BUY" || kind === "SELL") && (!Number.isFinite(grossN) || Math.abs(grossN) < 1e-12)) {
      if (Number.isFinite(qtyN) && qtyN > 0 && Number.isFinite(unitN) && unitN > 0) {
        grossN = Math.round(qtyN * unitN * 100) / 100;
      } else if (!Number.isFinite(grossN)) {
        grossN = 0;
      }
    } else if (!Number.isFinite(grossN)) {
      grossN = 0;
    }
    const feesN = Number.isFinite(Number(b.feesAmount)) ? Number(b.feesAmount) : 0;
    const taxN = Number.isFinite(Number(b.taxAmount)) ? Number(b.taxAmount) : 0;
    const normalizedGross = Math.max(0, grossN);
    const normalizedFees = Math.max(0, feesN);
    // DB-Constraint: SELL.tax_amount muss >= 0 sein.
    // Legacy-Daten können hier noch negatives Vorzeichen enthalten.
    const normalizedTax = kind === "SELL" ? Math.max(0, taxN) : taxN;
    return {
      user_id: userId,
      source_broker: trade.sourceBroker ?? "MANUAL",
      source_account: toNullable(trade.sourceAccount),
      position_id: positionId,
      kind,
      booked_at: parseLegacyDateToIso(b.bookedAtIso || b.bookedAtDisplay, `tx.${kind} legacy=${trade.id}`),
      qty: kind === "TAX_CORRECTION" || kind === "INCOME" ? null : Number.isFinite(qtyN) ? qtyN : null,
      unit_price: kind === "TAX_CORRECTION" || kind === "INCOME" ? null : Number.isFinite(unitN) ? unitN : null,
      gross_amount: normalizedGross,
      fees_amount: normalizedFees,
      tax_amount: normalizedTax,
      tax_mode: "MANUAL",
      note,
      legacy_trade_id: trade.id,
      legacy_leg: b.legacyLeg ?? (kind === "BUY" ? "BUY" : kind === "SELL" ? "SELL" : "INCOME"),
      // Für Tx-Unique-Key nur echte Ereignis-ID der jeweiligen Buchung verwenden.
      // Trade-weite Fallback-ID würde bei mehreren Legs (BUY/SELL) zu 23505 führen.
      external_transaction_id: normalizeExternalTransactionId(b.transactionId)
    };
  });
}

async function savePositionsDualWrite(userId: string, trades: Trade[]): Promise<void> {
  if (!supabase) return;

  if (dualWriteSnapshotWouldZeroOutRealMoney(trades)) {
    console.error(
      "[cloudStorage] Dual-Write für user_position_transactions ABGEBROCHEN: Snapshot enthält BUY/SELL mit Menge > 0 aber ohne Brutto/Stückpreis, obwohl der Trade noch Kauf-/Verkaufssummen hat. Keine DB-Zeilen gelöscht/überschrieben. Bitte lokale Daten prüfen oder JSON-Backup importieren."
    );
    return;
  }

  const relevantTrades = trades;
  const allowedLegacyIds = new Set(relevantTrades.map((t) => t.id));
  const { data: existingPos, error: existingPosError } = await supabase
    .from("user_positions")
    .select("position_id,legacy_trade_id")
    .eq("user_id", userId);
  if (existingPosError) throw existingPosError;

  const orphanPositionIds: string[] = [];
  for (const row of existingPos ?? []) {
    const pid = String((row as Record<string, unknown>).position_id ?? "").trim();
    const lid = String((row as Record<string, unknown>).legacy_trade_id ?? "").trim();
    if (!pid || !lid) continue;
    if (!allowedLegacyIds.has(lid)) orphanPositionIds.push(pid);
  }

  const deleteChunkSize = 400;
  for (let i = 0; i < orphanPositionIds.length; i += deleteChunkSize) {
    const chunk = orphanPositionIds.slice(i, i + deleteChunkSize);
    const { error: delOrphanError } = await supabase.from("user_positions").delete().eq("user_id", userId).in("position_id", chunk);
    if (delOrphanError) throw delOrphanError;
  }
  if (orphanPositionIds.length > 0) {
    console.info(`[cloudStorage] ${orphanPositionIds.length} verwaiste user_positions-Zeile(n) entfernt (legacy_trade_id ohne zugehörigen Trade im Snapshot).`);
  }

  if (relevantTrades.length === 0) return;

  const positionRows = relevantTrades.map((trade) => {
    const isIncome = trade.typ === "Dividende" || trade.typ === "Zinszahlung";
    const openedIso = parseLegacyDateToIso(trade.kaufzeitpunkt, `position.opened_at legacy=${trade.id}`);
    const closedIso =
      trade.status === "Geschlossen"
        ? parseLegacyDateToIso(
            isIncome ? trade.kaufzeitpunkt : trade.verkaufszeitpunkt ?? trade.kaufzeitpunkt,
            `position.closed_at legacy=${trade.id}`
          )
        : null;
    return {
      user_id: userId,
      source_broker: trade.sourceBroker ?? "MANUAL",
      source_account: toNullable(trade.sourceAccount),
      name: trade.name,
      typ: trade.typ,
      basiswert: trade.basiswert ?? "",
      isin: toNullable(trade.isin),
      wkn: toNullable(trade.wkn),
      notiz: toNullable(trade.notiz),
      opened_at: openedIso,
      closed_at: closedIso,
      status: trade.status === "Geschlossen" ? "CLOSED" : "OPEN",
      manual_checked: !!trade.manualChecked,
      legacy_trade_id: trade.id
    };
  });

  const { error: upsertPositionsError } = await supabase
    .from("user_positions")
    .upsert(positionRows, { onConflict: "user_id,legacy_trade_id" });
  if (upsertPositionsError) throw upsertPositionsError;

  const { data: currentPositions, error: loadPositionsError } = await supabase
    .from("user_positions")
    .select("position_id,legacy_trade_id")
    .eq("user_id", userId)
    .not("legacy_trade_id", "is", null);
  if (loadPositionsError) throw loadPositionsError;

  const posIdByLegacy = new Map<string, string>();
  for (const row of currentPositions ?? []) {
    const legacyTradeId = String((row as Record<string, unknown>).legacy_trade_id ?? "");
    const posId = String((row as Record<string, unknown>).position_id ?? "");
    if (!legacyTradeId || !posId) continue;
    posIdByLegacy.set(legacyTradeId, posId);
  }

  const txRows: TxRowPayload[] = [];
  for (const trade of relevantTrades) {
    const positionId = posIdByLegacy.get(trade.id);
    if (!positionId) continue;
    txRows.push(...buildTxRowsForTrade(userId, trade, positionId));
  }

  if (txRows.length === 0) return;
  const dedupedTxRows = dedupeTxRowsByConflictKey(txRows);
  if (dedupedTxRows.length === 0) return;
  if (dedupedTxRows.length < txRows.length) {
    console.warn(
      `[cloudStorage] ${txRows.length - dedupedTxRows.length} doppelte Tx-Zeile(n) in Upsert-Payload entfernt (Konfliktkey user_id+legacy_trade_id+legacy_leg).`
    );
  }

  // Vorab-Bereinigung für unique (user_id, source_broker, external_transaction_id):
  // verhindert erwartbare 409-Fehler schon vor dem ersten Upsert.
  const { data: existingExternalRows, error: existingExternalRowsError } = await supabase
    .from("user_position_transactions")
    .select("source_broker,external_transaction_id,legacy_trade_id,legacy_leg")
    .eq("user_id", userId)
    .not("external_transaction_id", "is", null);
  if (existingExternalRowsError) throw existingExternalRowsError;

  const ownerByExternalKey = new Map<string, string>();
  for (const row of existingExternalRows ?? []) {
    const externalId = String((row as Record<string, unknown>).external_transaction_id ?? "").trim();
    if (!externalId) continue;
    const key = `${userId}::${String((row as Record<string, unknown>).source_broker ?? "")}::${externalId}`;
    const owner = `${String((row as Record<string, unknown>).legacy_trade_id ?? "")}::${String((row as Record<string, unknown>).legacy_leg ?? "")}`;
    ownerByExternalKey.set(key, owner);
  }

  const seenPayloadExternal = new Map<string, string>();
  const sanitizedTxRows = dedupedTxRows.map((row) => {
    const externalId = String(row.external_transaction_id ?? "").trim();
    if (!externalId) return row;
    const externalKey = txExternalUniqueKey(row);
    const rowOwner = `${String(row.legacy_trade_id ?? "")}::${String(row.legacy_leg ?? "")}`;
    const existingOwner = ownerByExternalKey.get(externalKey);
    const payloadOwner = seenPayloadExternal.get(externalKey);
    const conflictsWithExisting = !!existingOwner && existingOwner !== rowOwner;
    const conflictsInPayload = !!payloadOwner && payloadOwner !== rowOwner;
    if (conflictsWithExisting || conflictsInPayload) {
      return { ...row, external_transaction_id: null };
    }
    seenPayloadExternal.set(externalKey, rowOwner);
    return row;
  });
  // Sicherheitsänderung:
  // - keine "delete all then insert"-Strategie mehr (verhindert Totalverlust bei Insert-Fehlern)
  // - stattdessen idempotentes Upsert über legacy-Schlüssel
  const { error: upsertTxError } = await supabase
    .from("user_position_transactions")
    .upsert(sanitizedTxRows, { onConflict: "user_id,legacy_trade_id,legacy_leg" });
  if (upsertTxError) {
    // Fallback für Bestandsdaten:
    // Wenn externe Event-IDs in mehreren Legs kollidieren, priorisieren wir funktionierende
    // Cloud-Synchronisierung vor Persistenz der optionalen external_transaction_id.
    if (isExternalIdUniqueConflict(upsertTxError)) {
      const txRowsWithoutExternal = dedupedTxRows.map((row) => ({
        ...row,
        external_transaction_id: null
      }));
      const { error: retryError } = await supabase
        .from("user_position_transactions")
        .upsert(txRowsWithoutExternal, { onConflict: "user_id,legacy_trade_id,legacy_leg" });
      if (!retryError) {
        console.warn(
          "[cloudStorage] external_transaction_id-Unique-Konflikt erkannt; Tx-Upsert erfolgreich mit external_transaction_id=null wiederholt."
        );
      } else {
        throw retryError;
      }
    } else {
      throw upsertTxError;
    }
  }

  // Optionale Bereinigung veralteter Legs pro Trade:
  // Löscht nur Legs von Trades im aktuellen Snapshot, die nicht mehr erzeugt wurden.
  const expectedLegPairs = new Set(
    dedupedTxRows.map((row) => `${String(row.legacy_trade_id ?? "")}::${String(row.legacy_leg ?? "")}`)
  );
  const legacyIds = [...new Set(dedupedTxRows.map((row) => String(row.legacy_trade_id ?? "")).filter(Boolean))];
  if (legacyIds.length > 0) {
    const { data: existingTxRows, error: existingTxError } = await supabase
      .from("user_position_transactions")
      .select("transaction_id,legacy_trade_id,legacy_leg")
      .eq("user_id", userId)
      .in("legacy_trade_id", legacyIds);
    if (existingTxError) throw existingTxError;

    const staleTxIds = (existingTxRows ?? [])
      .filter((row) => {
        const key = `${String((row as Record<string, unknown>).legacy_trade_id ?? "")}::${String((row as Record<string, unknown>).legacy_leg ?? "")}`;
        return !expectedLegPairs.has(key);
      })
      .map((row) => String((row as Record<string, unknown>).transaction_id ?? ""))
      .filter(Boolean);

    if (staleTxIds.length > 0) {
      const { error: deleteStaleError } = await supabase
        .from("user_position_transactions")
        .delete()
        .eq("user_id", userId)
        .in("transaction_id", staleTxIds);
      if (deleteStaleError) throw deleteStaleError;
    }
  }
}
