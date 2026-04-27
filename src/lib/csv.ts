import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Trade } from "../types/trade";
import type { AssetMeta } from "../app/types";

type Row = Record<string, string | undefined>;

/**
 * Parses currency amounts from CSV (€, $, optional spaces).
 * Supports:
 * - US-style: 1,234.56
 * - DE-style: 1.234,56
 * - Simple: 123.45 or 123,45
 */
export function parseMoney(value: string | undefined): number {
  if (!value) return 0;
  let s = value.replace(/[€$\s\u00a0]/g, "").replace(/^\+/, "").trim();
  if (!s || s === "-") return 0;

  const negative = s.startsWith("-");
  s = negative ? s.slice(1) : s;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 3 && /^\d{1,3}$/.test(parts[0])) {
      s = parts[0] + parts[1];
    } else {
      s = s.replace(",", ".");
    }
  } else if (hasDot && !hasComma) {
    const parts = s.split(".");
    if (parts.length > 2) {
      const last = parts[parts.length - 1] ?? "";
      if (last.length <= 2) {
        s = parts.slice(0, -1).join("") + "." + last;
      } else {
        s = parts.join("");
      }
    }
  }

  const n = Number.parseFloat(negative ? `-${s}` : s);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalMoney(value: string | undefined): number | undefined {
  if (!value || value === "-" || !String(value).trim()) return undefined;
  const n = parseMoney(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Stück: oft DE-Dezimal (2,207505) oder US (48.959…); manchmal Tausender 1,234 */
function parseStueck(value: string | undefined): number | undefined {
  if (!value || value === "-" || !String(value).trim()) return undefined;
  let s = String(value).trim().replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, "");
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  }
  if (s.includes(",") && !s.includes(".")) {
    const n = Number.parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Alle Header-Namen lowercase + ohne BOM → einheitlicher Lookup */
function toCanonRow(raw: Row): Row {
  const c: Row = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = k.replace(/^\ufeff/, "").trim().toLowerCase();
    c[nk] = v;
  }
  return c;
}

function pick(row: Row, ...names: string[]): string | undefined {
  for (const name of names) {
    const key = name.toLowerCase();
    const v = row[key];
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

/** Erste Zeilen `sep=;` / `sep=,` (Excel) entfernen */
function stripLeadingSepDirective(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0) {
    const t = out[0].replace(/^\ufeff/, "").trim();
    if (/^sep\s*=/i.test(t)) out.shift();
    else break;
  }
  return out;
}

function detectDelimiterFromHeaderLine(line: string): string {
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  if (semi > comma) return ";";
  if (comma > semi) return ",";
  return line.includes(";") ? ";" : ",";
}

function isLikelyTradesHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  const hasId = /\btradeid\b|\btrade_id\b/.test(lower) || /(^|[;\t,])id($|[;\t,])/i.test(lower);
  const hasName = /\bname\b/.test(lower);
  return hasId && hasName && /[;,\t]/.test(line);
}

function isLikelyAssetsHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  return /\bname\b/.test(lower) && (/\bcategory\b|\bkategorie\b/.test(lower) || /\bticker\b/.test(lower)) && /[;,\t]/.test(line);
}

function inferStatus(row: Row): "Offen" | "Geschlossen" {
  const statusRaw = pick(row, "status");
  if (statusRaw === "Offen" || statusRaw === "Geschlossen") return statusRaw;

  const verkaufDatum = pick(row, "verkaufszeitpunkt", "verkaufsdatum", "schlusszeitpunkt");
  const hasCloseDate = !!(verkaufDatum && verkaufDatum !== "-");
  if (hasCloseDate) return "Geschlossen";

  const gewinn = parseOptionalMoney(pick(row, "gewinn", "pnl", "profit", "gewinn/verlust"));
  const verkaufPreis = parseOptionalMoney(
    pick(row, "verkaufpreis", "verkaufbetrag", "verkauf €", "verkauf_eur", "auszahlung")
  );
  const hasMeaningfulResult = (gewinn ?? 0) !== 0 || (verkaufPreis ?? 0) !== 0;
  return hasMeaningfulResult ? "Geschlossen" : "Offen";
}

function rowId(row: Row, index: number): string {
  const raw = pick(row, "tradeid", "id", "trade_id")?.trim();
  if (raw) return raw;
  const name = pick(row, "name") ?? "trade";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `import-${slug || "row"}-${index}`;
}

export function parseTradesCsv(csvText: string): Trade[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.replace(/^\ufeff/, ""))
    .filter((l) => l.trim() !== "");
  const withoutSep = stripLeadingSepDirective(lines);
  const headerIndex = withoutSep.findIndex((line) => isLikelyTradesHeaderLine(line));
  const fromHeader = headerIndex >= 0 ? withoutSep.slice(headerIndex) : withoutSep;
  if (fromHeader.length === 0) return [];

  const delimiter = detectDelimiterFromHeaderLine(fromHeader[0] ?? "");
  const body = fromHeader.join("\n");

  const parsed = Papa.parse<Row>(body, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (h) => h.replace(/^\ufeff/, "").trim()
  });

  return parseTradeRows(parsed.data);
}

function parseTradeRows(rows: Row[]): Trade[] {
  return rows
    .map((raw) => toCanonRow(raw))
    .filter((row) => pick(row, "name"))
    .map((row, index) => {
      const status = inferStatus(row);
      const verkaufDatum = pick(row, "verkaufszeitpunkt", "verkaufsdatum", "schlusszeitpunkt");
      const sellDate = verkaufDatum && verkaufDatum !== "-" ? verkaufDatum : undefined;

      const kaufStr = pick(row, "kaufpreis", "kaufbetrag", "kauf €", "kauf_eur", "einkauf");
      const kaufStueckpreis = parseOptionalMoney(pick(row, "kaufstueckpreis", "kauf_stueckpreis", "stückpreis_kauf", "buy_unit_price"));
      const kaufTransaktionManuell = parseOptionalMoney(pick(row, "kauftransaktionmanuell", "kauf_transaktion_manuell", "manual_buy_transaction"));
      const kaufGebuehren = parseOptionalMoney(pick(row, "kaufgebuehren", "kauf_gebuehren", "gebuehren_kauf", "buy_fees"));
      const kaufPreisManuell = parseOptionalMoney(pick(row, "kaufpreismanuell", "kaufpreis_manuell", "manual_buy_total"));
      const verkaufStr = pick(
        row,
        "verkaufpreis",
        "verkaufbetrag",
        "verkauf €",
        "verkauf_eur",
        "auszahlung"
      );
      const gewinnStr = pick(row, "gewinn", "pnl", "profit", "gewinn/verlust");
      const verkaufStueckpreis = parseOptionalMoney(pick(row, "verkaufstueckpreis", "verkauf_stueckpreis", "stückpreis_verkauf", "sell_unit_price"));
      const verkaufTransaktionManuell = parseOptionalMoney(pick(row, "verkauftransaktionmanuell", "verkauf_transaktion_manuell", "manual_sell_transaction"));
      const verkaufSteuern = parseOptionalMoney(pick(row, "verkaufsteuern", "verkauf_steuern", "steuern", "taxes"));
      const verkaufGebuehren = parseOptionalMoney(pick(row, "verkaufgebuehren", "verkauf_gebuehren", "gebuehren_verkauf", "sell_fees"));
      const verkaufPreisManuell = parseOptionalMoney(pick(row, "verkaufpreismanuell", "verkaufpreis_manuell", "manual_sell_total"));

      const sellPriceRaw = parseOptionalMoney(verkaufStr);
      const gewinnRaw = parseOptionalMoney(gewinnStr);

      const sellPrice =
        status === "Offen" && !sellDate && (sellPriceRaw ?? 0) === 0 ? undefined : sellPriceRaw;
      const gewinn =
        status === "Offen" && !sellDate && (gewinnRaw ?? 0) === 0 ? undefined : gewinnRaw;

      return {
        id: rowId(row, index),
        name: pick(row, "name") ?? "",
        typ: (pick(row, "typ", "type", "art") ?? "Aktie") as Trade["typ"],
        basiswert: pick(row, "basiswert", "underlying", "asset") ?? "Unknown",
        isin: pick(row, "isin", "isin_code", "isincode"),
        wkn: pick(row, "wkn", "wertpapierkennnummer"),
        notiz: pick(row, "notiz", "notizen", "kommentar", "kommentare", "note", "notes"),
        kaufzeitpunkt: pick(row, "kaufzeitpunkt", "kaufdatum", "einstieg") ?? "",
        kaufPreis: parseMoney(kaufStr),
        stueck: parseStueck(pick(row, "stueck", "stück", "menge", "qty", "quantity")),
        kaufStueckpreis,
        kaufTransaktionManuell,
        kaufGebuehren,
        kaufPreisManuell,
        verkaufszeitpunkt: sellDate,
        verkaufPreis: sellPrice,
        verkaufStueckpreis,
        verkaufTransaktionManuell,
        verkaufSteuern,
        verkaufGebuehren,
        verkaufPreisManuell,
        gewinn,
        status
      };
    });
}

export async function parseTradesExcel(file: File): Promise<Trade[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  return parseTradeRows(rows);
}

function parseAssetRows(rows: Row[]): AssetMeta[] {
  return rows
    .map((raw) => toCanonRow(raw))
    .map((row) => {
      const name = pick(row, "name", "basiswert", "asset", "underlying") ?? "";
      const tickerDirect = pick(row, "ticker", "symbol", "tv", "tradingview");
      const tickerUs = pick(row, "tickerus", "ticker_us", "ticker us");
      const tickerXetra = pick(row, "tickerxetra", "ticker_xetra", "ticker xetra");
      const tickerMerged =
        tickerDirect?.trim() ||
        [tickerUs, tickerXetra].find((s) => s?.includes(":"))?.trim() ||
        tickerUs?.trim() ||
        tickerXetra?.trim() ||
        undefined;
      return {
        name: name.trim(),
        category: pick(row, "category", "kategorie"),
        ticker: tickerMerged,
        waehrung: pick(row, "waehrung", "währung", "currency")
      } satisfies AssetMeta;
    })
    .filter((item) => item.name.length > 0);
}

export function parseAssetsCsv(csvText: string): AssetMeta[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.replace(/^\ufeff/, ""))
    .filter((l) => l.trim() !== "");
  const withoutSep = stripLeadingSepDirective(lines);
  const headerIndex = withoutSep.findIndex((line) => isLikelyAssetsHeaderLine(line));
  const fromHeader = headerIndex >= 0 ? withoutSep.slice(headerIndex) : withoutSep;
  if (fromHeader.length === 0) return [];

  const delimiter = detectDelimiterFromHeaderLine(fromHeader[0] ?? "");
  const body = fromHeader.join("\n");

  const parsed = Papa.parse<Row>(body, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (h) => h.replace(/^\ufeff/, "").trim()
  });
  return parseAssetRows(parsed.data);
}

export async function parseAssetsExcel(file: File): Promise<AssetMeta[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  return parseAssetRows(rows);
}
