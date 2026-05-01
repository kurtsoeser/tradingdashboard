import { useMemo, useState } from "react";
import Papa from "papaparse";
import { ArrowLeft, ArrowRight, FileUp, ListChecks } from "lucide-react";
import { PageHeader } from "../PageHeader";
import { t } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import type { Trade } from "../../types/trade";
import { supabase } from "../../lib/supabaseClient";
import { buildFlatBookingRows, type FlatBookingRow } from "../../lib/flattenBookings";

type CsvRow = Record<string, string>;

interface ImportViewProps {
  language: AppSettings["language"];
  existingTradesCount: number;
  existingTrades: Trade[];
  userId: string | null;
  onCommitImportedTrades: (nextTrades: Trade[]) => void;
}

const MAX_PREVIEW_ROWS = 25;
const AMOUNT_TOLERANCE = 0.02;

type CompareStatus = "NEU" | "IDENTISCH" | "ABWEICHUNG" | "KONFLIKT";
type ImportDecision = "AUTO" | "IMPORT_NEW" | "SKIP" | "TR_WINS";
type FinalAction = "CREATE" | "UPDATE" | "SKIP" | "REVIEW";
type Step4Filter = "ALL" | CompareStatus;

interface CompareResult {
  rowIndex: number;
  transactionId: string;
  csvType: string;
  csvName: string;
  csvIsin: string;
  csvDate: string;
  csvExpectedAmount: number | null;
  status: CompareStatus;
  matchedTradeId?: string;
  matchedTradeName?: string;
  matchedBookingKind?: string;
  reason: string;
}

interface ExecutionResult {
  created: number;
  updated: number;
  skipped: number;
  review: number;
  executedAt: string;
  persistedEvents: number;
}

function defaultDecisionForStatus(status: CompareStatus): ImportDecision {
  if (status === "NEU") return "IMPORT_NEW";
  if (status === "IDENTISCH") return "SKIP";
  if (status === "ABWEICHUNG") return "TR_WINS";
  return "AUTO";
}

function resolveFinalAction(status: CompareStatus, decision: ImportDecision): FinalAction {
  if (decision === "IMPORT_NEW") return "CREATE";
  if (decision === "SKIP") return "SKIP";
  if (decision === "TR_WINS") return "UPDATE";
  if (status === "NEU") return "CREATE";
  if (status === "IDENTISCH") return "SKIP";
  if (status === "ABWEICHUNG") return "UPDATE";
  return "REVIEW";
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function isoFromCsv(row: CsvRow): string {
  const raw = (row.datetime ?? "").trim();
  if (raw) return raw;
  const d = (row.date ?? "").trim();
  return d ? `${d}T00:00:00Z` : new Date().toISOString();
}

function csvTypeToBookingKind(typeRaw: string): FlatBookingRow["booking"]["kind"] | null {
  const type = typeRaw.trim().toUpperCase();
  if (type === "BUY") return "BUY";
  if (type === "SELL") return "SELL";
  if (type === "DIVIDEND" || type === "INTEREST_PAYMENT" || type === "STOCKPERK") return "INCOME";
  if (type === "TAX_OPTIMIZATION") return "TAX_CORRECTION";
  return null;
}

function sameDay(a: string, b: string): boolean {
  return toDateKey(a) !== "" && toDateKey(a) === toDateKey(b);
}

function amountClose(a: number | null, b: number | null): boolean {
  return approxEqual(a === null ? null : Math.abs(a), b === null ? null : Math.abs(b), 0.05);
}

function qtyClose(a: number | null, b: number | null): boolean {
  return approxEqual(a === null ? null : Math.abs(a), b === null ? null : Math.abs(b), 0.0001);
}

function classifyBookingCandidate(row: CsvRow, candidate: FlatBookingRow) {
  const booking = candidate.booking;
  let score = 0;

  const csvName = (row.name ?? "").trim().toLowerCase();
  const csvDateRaw = row.datetime || row.date || "";
  const csvAmount = parseNumber(row.amount);
  const csvFee = parseNumber(row.fee);
  const csvQty = parseNumber(row.shares);

  const tradeName = candidate.tradeName.trim().toLowerCase();
  const tradeBasis = candidate.basiswert.trim().toLowerCase();

  if (csvName && (tradeName.includes(csvName) || csvName.includes(tradeName) || tradeBasis.includes(csvName))) {
    score += 20;
  }

  if (sameDay(csvDateRaw, booking.bookedAtIso)) {
    score += 25;
  }

  if (amountClose(csvAmount, booking.grossAmount)) {
    score += 30;
  }

  if (amountClose(csvFee, booking.feesAmount)) {
    score += 10;
  }

  if (qtyClose(csvQty, booking.qty ?? null)) {
    score += 15;
  }

  const strongMatch = sameDay(csvDateRaw, booking.bookedAtIso) && amountClose(csvAmount, booking.grossAmount);
  return { score, strongMatch };
}

function approxEqual(a: number | null, b: number | null, tolerance = AMOUNT_TOLERANCE): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

function toDateKey(value: string | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function mapCsvToExpectedAmount(row: CsvRow): number | null {
  const amount = parseNumber(row.amount);
  const fee = parseNumber(row.fee) ?? 0;
  const tax = parseNumber(row.tax) ?? 0;
  const type = (row.type ?? "").trim().toUpperCase();

  if (amount === null) return null;
  if (type === "BUY") return Math.abs(amount + fee + tax);
  if (type === "SELL") return amount + fee + tax;
  if (type === "DIVIDEND" || type === "INTEREST_PAYMENT") return amount + fee + tax;
  if (type === "TAX_OPTIMIZATION") return tax;
  return amount + fee + tax;
}

export function ImportView({ language, existingTradesCount, existingTrades, userId, onCommitImportedTrades }: ImportViewProps) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({});
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [step4Filter, setStep4Filter] = useState<Step4Filter>("ALL");

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const category = (row.category ?? "").trim();
      const type = (row.type ?? "").trim();
      const key = [category, type].filter(Boolean).join(" / ") || t(language, "importUnknownType");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [language, rows]);

  const canMoveToNextStep = step === 1 ? rows.length > 0 : true;

  const compareResults = useMemo<CompareResult[]>(() => {
    if (rows.length === 0) return [];
    const flatBookings = buildFlatBookingRows(existingTrades);

    return rows.map((row, rowIndex) => {
      const bookingKind = csvTypeToBookingKind(row.type ?? "");
      if (!bookingKind) {
        return {
          rowIndex,
          transactionId: (row.transaction_id ?? "").trim(),
          csvType: (row.type ?? "").trim(),
          csvName: (row.name ?? "").trim(),
          csvIsin: (row.symbol ?? "").trim(),
          csvDate: toDateKey(row.datetime || row.date),
          csvExpectedAmount: mapCsvToExpectedAmount(row),
          status: "NEU",
          reason: t(language, "importCompareReasonTypeNotMatched")
        };
      }

      const candidates = flatBookings
        .filter((candidate) => candidate.booking.kind === bookingKind)
        .map((candidate) => ({ candidate, ...classifyBookingCandidate(row, candidate) }))
        .filter((candidate) => candidate.score >= 45)
        .sort((a, b) => b.score - a.score);

      const transactionId = (row.transaction_id ?? "").trim();
      const csvType = (row.type ?? "").trim();
      const csvName = (row.name ?? "").trim();
      const csvIsin = (row.symbol ?? "").trim();
      const csvDate = toDateKey(row.datetime || row.date);
      const csvExpectedAmount = mapCsvToExpectedAmount(row);

      if (candidates.length === 0) {
        return {
          rowIndex,
          transactionId,
          csvType,
          csvName,
          csvIsin,
          csvDate,
          csvExpectedAmount,
          status: "NEU",
          reason: t(language, "importCompareReasonNew")
        };
      }

      if (candidates.length > 1 && candidates[0].score - candidates[1].score < 8) {
        return {
          rowIndex,
          transactionId,
          csvType,
          csvName,
          csvIsin,
          csvDate,
          csvExpectedAmount,
          status: "KONFLIKT",
          reason: t(language, "importCompareReasonConflict")
        };
      }

      const best = candidates[0];
      const identical = best.strongMatch;

      return {
        rowIndex,
        transactionId,
        csvType,
        csvName,
        csvIsin,
        csvDate,
        csvExpectedAmount,
        status: identical ? "IDENTISCH" : "ABWEICHUNG",
        matchedTradeId: best.candidate.tradeId,
        matchedTradeName: best.candidate.tradeName,
        matchedBookingKind: best.candidate.booking.kind,
        reason: identical ? t(language, "importCompareReasonIdentical") : t(language, "importCompareReasonDiff")
      };
    });
  }, [existingTrades, language, rows]);

  const compareSummary = useMemo(() => {
    const summary: Record<CompareStatus, number> = {
      NEU: 0,
      IDENTISCH: 0,
      ABWEICHUNG: 0,
      KONFLIKT: 0
    };
    for (const result of compareResults) summary[result.status] += 1;
    return summary;
  }, [compareResults]);

  const effectiveDecisions = useMemo(
    () =>
      compareResults.map((result) => ({
        rowIndex: result.rowIndex,
        decision: decisions[result.rowIndex] ?? defaultDecisionForStatus(result.status)
      })),
    [compareResults, decisions]
  );

  const decisionSummary = useMemo(() => {
    const summary: Record<ImportDecision, number> = {
      AUTO: 0,
      IMPORT_NEW: 0,
      SKIP: 0,
      TR_WINS: 0
    };
    for (const item of effectiveDecisions) summary[item.decision] += 1;
    return summary;
  }, [effectiveDecisions]);

  const filteredStep4Results = useMemo(
    () => compareResults.filter((result) => (step4Filter === "ALL" ? true : result.status === step4Filter)),
    [compareResults, step4Filter]
  );

  const executionPlan = useMemo(
    () =>
      compareResults.map((result) => {
        const decision = decisions[result.rowIndex] ?? defaultDecisionForStatus(result.status);
        const action = resolveFinalAction(result.status, decision);
        return {
          ...result,
          decision,
          action
        };
      }),
    [compareResults, decisions]
  );

  const executionSummary = useMemo(() => {
    const summary: Record<FinalAction, number> = {
      CREATE: 0,
      UPDATE: 0,
      SKIP: 0,
      REVIEW: 0
    };
    for (const item of executionPlan) summary[item.action] += 1;
    return summary;
  }, [executionPlan]);

  const unresolvedReviewRows = useMemo(
    () => executionPlan.filter((item) => item.action === "REVIEW"),
    [executionPlan]
  );

  const onSelectCsvFile = async (file: File) => {
    setFileName(file.name);
    setError(null);

    try {
      const csvText = await file.text();
      const parsed = Papa.parse<CsvRow>(csvText, {
        header: true,
        skipEmptyLines: true
      });

      if (parsed.errors.length > 0) {
        setHeaders([]);
        setRows([]);
        setError(parsed.errors[0]?.message ?? t(language, "importParseError"));
        return;
      }

      const parsedHeaders = (parsed.meta.fields ?? []).map((field) => field.trim()).filter(Boolean);
      const parsedRows = parsed.data
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, value ?? ""])
          ) as CsvRow
        )
        .filter((row) => Object.values(row).some((value) => String(value).trim() !== ""));

      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setDecisions({});
      setExecutionResult(null);
      setStep4Filter("ALL");
      if (step < 2 && parsedRows.length > 0) setStep(2);
    } catch {
      setHeaders([]);
      setRows([]);
      setError(t(language, "importParseError"));
    }
  };

  const stepTitles = [
    t(language, "importStep1"),
    t(language, "importStep2"),
    t(language, "importStep3"),
    t(language, "importStep4"),
    t(language, "importStep5"),
    t(language, "importStep6")
  ];

  const decisionLabelByValue: Record<ImportDecision, string> = {
    AUTO: t(language, "importDecisionLabel_AUTO"),
    IMPORT_NEW: t(language, "importDecisionLabel_IMPORT_NEW"),
    SKIP: t(language, "importDecisionLabel_SKIP"),
    TR_WINS: t(language, "importDecisionLabel_TR_WINS")
  };

  const finalActionLabelByValue: Record<FinalAction, string> = {
    CREATE: t(language, "importFinalActionLabel_CREATE"),
    UPDATE: t(language, "importFinalActionLabel_UPDATE"),
    SKIP: t(language, "importFinalActionLabel_SKIP"),
    REVIEW: t(language, "importFinalActionLabel_REVIEW")
  };

  const applyBulkDecision = (decision: ImportDecision, statuses?: CompareStatus[]) => {
    const allowed = statuses ? new Set(statuses) : null;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const result of compareResults) {
        if (allowed && !allowed.has(result.status)) continue;
        next[result.rowIndex] = decision;
      }
      return next;
    });
  };

  const resetDecisionsToAuto = () => {
    setDecisions({});
  };

  const runExecutionPreview = async () => {
    if (!userId || !supabase) {
      setError(t(language, "importExecuteMissingAuth"));
      return;
    }
    if (unresolvedReviewRows.length > 0) {
      setError(
        t(language, "importExecuteBlockedByReview", {
          count: unresolvedReviewRows.length
        })
      );
      return;
    }
    setExecuting(true);
    setError(null);
    try {
      const eventRows = rows
        .filter((row) => (row.transaction_id ?? "").trim() !== "")
        .map((row) => ({
          user_id: userId,
          source_broker: "TRADE_REPUBLIC",
          source_account: (row.account_type ?? "").trim() || null,
          external_event_id: (row.transaction_id ?? "").trim(),
          event_time: isoFromCsv(row),
          event_date: (row.date ?? "").trim() || null,
          category: (row.category ?? "").trim() || "UNKNOWN",
          type: (row.type ?? "").trim() || "UNKNOWN",
          asset_class: (row.asset_class ?? "").trim() || null,
          name: (row.name ?? "").trim() || null,
          symbol: (row.symbol ?? "").trim() || null,
          shares: parseNumber(row.shares),
          price: parseNumber(row.price),
          amount: parseNumber(row.amount),
          fee: parseNumber(row.fee),
          tax: parseNumber(row.tax),
          currency: (row.currency ?? "").trim() || null,
          original_amount: parseNumber(row.original_amount),
          original_currency: (row.original_currency ?? "").trim() || null,
          fx_rate: parseNumber(row.fx_rate),
          description: (row.description ?? "").trim() || null,
          raw_payload: row
        }));

      if (eventRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("user_broker_events")
          .upsert(eventRows, { onConflict: "user_id,source_broker,external_event_id" });
        if (upsertError) throw upsertError;
      }

      const planByTx = new Map(executionPlan.map((item) => [item.transactionId, item]));
      let nextTrades = [...existingTrades];

      for (const row of rows) {
        const txId = (row.transaction_id ?? "").trim();
        const planItem = planByTx.get(txId);
        if (!planItem) continue;
        if (planItem.action === "SKIP" || planItem.action === "REVIEW") continue;

        const csvType = (row.type ?? "").trim().toUpperCase();
        const isin = (row.symbol ?? "").trim();
        const name = (row.name ?? "").trim() || (row.description ?? "").trim() || "TR Import";
        const qty = Math.abs(parseNumber(row.shares) ?? 0);
        const price = Math.abs(parseNumber(row.price) ?? 0);
        const fee = parseNumber(row.fee) ?? 0;
        const tax = parseNumber(row.tax) ?? 0;
        const amount = parseNumber(row.amount) ?? 0;
        const buyTotal = Math.abs(amount + fee + tax);
        const eventTime = isoFromCsv(row);

        if (csvType === "BUY" && planItem.action === "CREATE") {
          const tradeId = `tr-${txId}`;
          const already = nextTrades.some((trade) => trade.id === tradeId);
          if (already) continue;
          const typ = (row.asset_class ?? "").trim().toUpperCase() === "STOCK" ? "Aktie" : "Derivat";
          nextTrades = [
            {
              id: tradeId,
              sourceBroker: "TRADE_REPUBLIC",
              sourceAccount: (row.account_type ?? "").trim() || undefined,
              externalEventId: txId,
              name,
              typ,
              basiswert: name,
              isin: isin || undefined,
              kaufzeitpunkt: eventTime,
              kaufPreis: buyTotal,
              stueck: qty > 0 ? qty : undefined,
              kaufStueckpreis: price > 0 ? price : undefined,
              kaufTransaktionManuell: Math.abs(amount),
              kaufGebuehren: fee,
              status: "Offen"
            },
            ...nextTrades
          ];
          continue;
        }

        if (csvType === "SELL" && (planItem.action === "UPDATE" || planItem.action === "CREATE")) {
          const openIndex = nextTrades.findIndex(
            (trade) =>
              trade.sourceBroker === "TRADE_REPUBLIC" &&
              trade.status === "Offen" &&
              (isin ? trade.isin === isin : trade.name.toLowerCase() === name.toLowerCase())
          );
          if (openIndex < 0) continue;
          const target = nextTrades[openIndex];
          const sellNet = amount + fee + tax;
          const updated: Trade = {
            ...target,
            verkaufszeitpunkt: eventTime,
            verkaufPreis: sellNet,
            verkaufStueckpreis: price > 0 ? price : target.verkaufStueckpreis,
            verkaufTransaktionManuell: amount,
            verkaufGebuehren: fee,
            verkaufSteuern: tax,
            gewinn: sellNet - target.kaufPreis,
            status: "Geschlossen"
          };
          nextTrades = nextTrades.map((trade, index) => (index === openIndex ? updated : trade));
        }
      }

      onCommitImportedTrades(nextTrades);

      const nextResult: ExecutionResult = {
        created: executionSummary.CREATE,
        updated: executionSummary.UPDATE,
        skipped: executionSummary.SKIP,
        review: executionSummary.REVIEW,
        executedAt: new Date().toLocaleString(),
        persistedEvents: eventRows.length
      };
      setExecutionResult(nextResult);
    } catch {
      setError(t(language, "importExecuteFailed"));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t(language, "importWizardTitle")}
        subtitle={t(language, "importWizardSubtitle")}
      />

      <section className="card import-steps-card">
        <div className="import-steps-track">
          {stepTitles.map((title, index) => {
            const number = index + 1;
            const active = number === step;
            const done = number < step;
            return (
              <button
                key={title}
                className={`import-step-pill ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
                type="button"
                onClick={() => setStep(number)}
              >
                <span>{number}</span>
                {title}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card section">
        {step === 1 && (
          <div className="import-step-content">
            <h3>
              <FileUp size={16} />
              {t(language, "importUploadTitle")}
            </h3>
            <p className="muted-help">{t(language, "importUploadHint")}</p>
            <label className="secondary file-pick-btn" htmlFor="tr-import-file">
              <FileUp size={14} />
              {t(language, "importUploadAction")}
            </label>
            <input
              id="tr-import-file"
              className="hidden-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void onSelectCsvFile(file);
              }}
            />
            {fileName ? <p className="file-name-label">{fileName}</p> : null}
            {error ? <p className="auth-error">{error}</p> : null}
          </div>
        )}

        {step === 2 && (
          <div className="import-step-content">
            <h3>
              <ListChecks size={16} />
              {t(language, "importPreviewTitle")}
            </h3>
            <p className="muted-help">
              {t(language, "importPreviewHint", { rows: rows.length, trades: existingTradesCount })}
            </p>

            {typeBreakdown.length > 0 && (
              <div className="import-breakdown">
                {typeBreakdown.slice(0, 8).map(([label, count]) => (
                  <span key={label} className="asset-badge">
                    {label}: {count}
                  </span>
                ))}
              </div>
            )}

            {headers.length > 0 && rows.length > 0 && (
              <div className="journal-week-table-wrap">
                <table className="journal-week-table">
                  <thead>
                    <tr>
                      {headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, MAX_PREVIEW_ROWS).map((row, index) => (
                      <tr key={`${index}-${row.transaction_id ?? ""}`}>
                        {headers.map((header) => (
                          <td key={`${index}-${header}`}>{row[header] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="import-step-content">
            <h3>{t(language, "importCompareTitle")}</h3>
            <p className="muted-help">{t(language, "importCompareHint")}</p>

            <div className="import-breakdown">
              <span className="asset-badge">{t(language, "importCompareNew")}: {compareSummary.NEU}</span>
              <span className="asset-badge">{t(language, "importCompareIdentical")}: {compareSummary.IDENTISCH}</span>
              <span className="asset-badge">{t(language, "importCompareDiff")}: {compareSummary.ABWEICHUNG}</span>
              <span className="asset-badge">{t(language, "importCompareConflict")}: {compareSummary.KONFLIKT}</span>
            </div>

            {compareResults.length > 0 && (
              <div className="journal-week-table-wrap">
                <table className="journal-week-table">
                  <thead>
                    <tr>
                      <th>{t(language, "importCompareColTxId")}</th>
                      <th>{t(language, "importCompareColType")}</th>
                      <th>{t(language, "importCompareColName")}</th>
                      <th>{t(language, "importCompareColDate")}</th>
                      <th>{t(language, "importCompareColAmount")}</th>
                      <th>{t(language, "importCompareColStatus")}</th>
                      <th>{t(language, "importCompareColMatch")}</th>
                      <th>{t(language, "importCompareColReason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResults.map((result) => (
                      <tr key={`${result.rowIndex}-${result.transactionId}`}>
                        <td>{result.transactionId || "-"}</td>
                        <td>{result.csvType || "-"}</td>
                        <td>{result.csvName || result.csvIsin || "-"}</td>
                        <td>{result.csvDate || "-"}</td>
                        <td>{result.csvExpectedAmount !== null ? result.csvExpectedAmount.toFixed(2) : "-"}</td>
                        <td>{result.status}</td>
                        <td>{result.matchedTradeName ?? "-"}</td>
                        <td>{result.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="import-step-content">
            <h3>{t(language, "importDecisionsTitle")}</h3>
            <p className="muted-help">{t(language, "importDecisionsHint")}</p>

            <div className="import-bulk-actions">
              <button className="secondary slim" type="button" onClick={() => applyBulkDecision("SKIP", ["KONFLIKT"])}>
                {t(language, "importBulkConflictsToSkip")}
              </button>
              <button className="secondary slim" type="button" onClick={() => applyBulkDecision("TR_WINS", ["ABWEICHUNG"])}>
                {t(language, "importBulkDiffsToTrWins")}
              </button>
              <button className="secondary slim" type="button" onClick={() => applyBulkDecision("IMPORT_NEW", ["NEU"])}>
                {t(language, "importBulkNewToImport")}
              </button>
              <button className="secondary slim" type="button" onClick={resetDecisionsToAuto}>
                {t(language, "importBulkResetAuto")}
              </button>
            </div>

            <label className="import-step4-filter">
              <span>{t(language, "importStep4FilterLabel")}</span>
              <select value={step4Filter} onChange={(event) => setStep4Filter(event.target.value as Step4Filter)}>
                <option value="ALL">{t(language, "importStep4FilterAll")}</option>
                <option value="KONFLIKT">{t(language, "importStep4FilterConflicts")}</option>
                <option value="ABWEICHUNG">{t(language, "importStep4FilterDiffs")}</option>
                <option value="NEU">{t(language, "importStep4FilterNew")}</option>
                <option value="IDENTISCH">{t(language, "importStep4FilterIdentical")}</option>
              </select>
            </label>
            <p className="muted-help">
              {t(language, "importStep4FilteredCount", {
                visible: filteredStep4Results.length,
                total: compareResults.length
              })}
            </p>

            <div className="import-breakdown">
              <span className="asset-badge">{t(language, "importDecisionAuto")}: {decisionSummary.AUTO}</span>
              <span className="asset-badge">{t(language, "importDecisionImportNew")}: {decisionSummary.IMPORT_NEW}</span>
              <span className="asset-badge">{t(language, "importDecisionSkip")}: {decisionSummary.SKIP}</span>
              <span className="asset-badge">{t(language, "importDecisionTrWins")}: {decisionSummary.TR_WINS}</span>
            </div>

            {filteredStep4Results.length > 0 && (
              <div className="journal-week-table-wrap">
                <table className="journal-week-table">
                  <thead>
                    <tr>
                      <th>{t(language, "importCompareColTxId")}</th>
                      <th>{t(language, "importCompareColStatus")}</th>
                      <th>{t(language, "importCompareColMatch")}</th>
                      <th>{t(language, "importDecisionColAction")}</th>
                      <th>{t(language, "importCompareColReason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStep4Results.map((result) => {
                      const currentDecision = decisions[result.rowIndex] ?? defaultDecisionForStatus(result.status);
                      return (
                        <tr key={`decision-${result.rowIndex}-${result.transactionId}`}>
                          <td>{result.transactionId || "-"}</td>
                          <td>{result.status}</td>
                          <td>{result.matchedTradeName ?? "-"}</td>
                          <td>
                            <select
                              value={currentDecision}
                              onChange={(event) =>
                                setDecisions((prev) => ({
                                  ...prev,
                                  [result.rowIndex]: event.target.value as ImportDecision
                                }))
                              }
                            >
                              <option value="AUTO">{t(language, "importDecisionAutoOption")}</option>
                              <option value="IMPORT_NEW">{t(language, "importDecisionImportNewOption")}</option>
                              <option value="SKIP">{t(language, "importDecisionSkipOption")}</option>
                              <option value="TR_WINS">{t(language, "importDecisionTrWinsOption")}</option>
                            </select>
                          </td>
                          <td>{result.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredStep4Results.length === 0 && (
              <p className="muted-help">{t(language, "importStep4FilterEmpty")}</p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="import-step-content">
            <h3>{t(language, "importExecutionPreviewTitle")}</h3>
            <p className="muted-help">{t(language, "importExecutionPreviewHint")}</p>

            <div className="import-breakdown">
              <span className="asset-badge">{t(language, "importActionCreate")}: {executionSummary.CREATE}</span>
              <span className="asset-badge">{t(language, "importActionUpdate")}: {executionSummary.UPDATE}</span>
              <span className="asset-badge">{t(language, "importActionSkip")}: {executionSummary.SKIP}</span>
              <span className="asset-badge">{t(language, "importActionReview")}: {executionSummary.REVIEW}</span>
            </div>

            {executionPlan.length > 0 && (
              <div className="journal-week-table-wrap">
                <table className="journal-week-table">
                  <thead>
                    <tr>
                      <th>{t(language, "importCompareColTxId")}</th>
                      <th>{t(language, "importCompareColStatus")}</th>
                      <th>{t(language, "importDecisionColAction")}</th>
                      <th>{t(language, "importExecutionColFinalAction")}</th>
                      <th>{t(language, "importCompareColMatch")}</th>
                      <th>{t(language, "importCompareColReason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executionPlan.map((item) => (
                      <tr key={`execution-${item.rowIndex}-${item.transactionId}`}>
                        <td>{item.transactionId || "-"}</td>
                        <td>{item.status}</td>
                        <td>{decisionLabelByValue[item.decision]}</td>
                        <td>{finalActionLabelByValue[item.action]}</td>
                        <td>{item.matchedTradeName ?? "-"}</td>
                        <td>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="import-step-content">
            <h3>{t(language, "importResultTitle")}</h3>
            <p className="muted-help">{t(language, "importResultHint")}</p>

            <div className="import-step-actions">
              <button className="primary" type="button" onClick={() => void runExecutionPreview()} disabled={executionPlan.length === 0 || executing || unresolvedReviewRows.length > 0}>
                {t(language, "importExecuteNow")}
              </button>
            </div>

            {unresolvedReviewRows.length > 0 && (
              <p className="auth-error">
                {t(language, "importExecuteBlockedByReview", { count: unresolvedReviewRows.length })}
              </p>
            )}

            {executionResult ? (
              <>
                <div className="import-breakdown">
                  <span className="asset-badge">{t(language, "importActionCreate")}: {executionResult.created}</span>
                  <span className="asset-badge">{t(language, "importActionUpdate")}: {executionResult.updated}</span>
                  <span className="asset-badge">{t(language, "importActionSkip")}: {executionResult.skipped}</span>
                  <span className="asset-badge">{t(language, "importActionReview")}: {executionResult.review}</span>
                  <span className="asset-badge">{t(language, "importResultPersistedEvents")}: {executionResult.persistedEvents}</span>
                </div>
                <p className="muted-help">{t(language, "importResultExecutedAt", { datetime: executionResult.executedAt })}</p>
                <p className="muted-help">{t(language, "importResultLiveNote")}</p>
              </>
            ) : (
              <p className="muted-help">{t(language, "importResultIdle")}</p>
            )}

            {executionPlan.length > 0 && (
              <div className="journal-week-table-wrap">
                <table className="journal-week-table">
                  <thead>
                    <tr>
                      <th>{t(language, "importCompareColTxId")}</th>
                      <th>{t(language, "importExecutionColFinalAction")}</th>
                      <th>{t(language, "importCompareColMatch")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executionPlan.map((item) => (
                      <tr key={`result-${item.rowIndex}-${item.transactionId}`}>
                        <td>{item.transactionId || "-"}</td>
                        <td>{finalActionLabelByValue[item.action]}</td>
                        <td>{item.matchedTradeName ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="section import-step-actions">
        <button
          className="secondary"
          type="button"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          disabled={step === 1}
        >
          <ArrowLeft size={14} />
          {t(language, "importBack")}
        </button>
        <button
          className="primary"
          type="button"
          onClick={() => setStep((current) => Math.min(6, current + 1))}
          disabled={step === 6 || !canMoveToNextStep}
        >
          {t(language, "importNext")}
          <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}
