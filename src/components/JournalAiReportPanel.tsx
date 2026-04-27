import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { buildJournalAiReportMarkdownForSession } from "../lib/journalAiReportContext";
import type { JournalData } from "../lib/journalStorage";
import type { Trade } from "../types/trade";

interface JournalAiReportPanelProps {
  language: AppSettings["language"];
  trades: Trade[];
  journalData: JournalData;
}

export function JournalAiReportPanel({ language, trades, journalData }: JournalAiReportPanelProps) {
  const [reportRevision, setReportRevision] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  const bumpNow = useCallback(() => {
    setReportRevision((r) => r + 1);
    setCopyState("idle");
  }, []);

  const reportMarkdown = useMemo(() => {
    return buildJournalAiReportMarkdownForSession({
      language,
      trades,
      journalData,
      now: new Date(),
      omitSuggestedPrompt: false
    });
  }, [trades, journalData, language, reportRevision]);

  const copyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportMarkdown);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("err");
      window.setTimeout(() => setCopyState("idle"), 4000);
    }
  }, [reportMarkdown]);

  const statusText =
    copyState === "ok" ? t(language, "journalAiReportCopied") : copyState === "err" ? t(language, "journalAiReportCopyFailed") : null;

  return (
    <div className="card journal-card journal-ai-report-card">
      <div className="journal-ai-report-head">
        <div className="journal-ai-report-head-text">
          <h3 className="journal-ai-report-title">
            <Sparkles size={16} aria-hidden />
            {t(language, "journalAiReportCardTitle")}
          </h3>
          <p className="journal-ai-report-sub">{t(language, "journalAiReportCardSubtitle")}</p>
        </div>
        <div className="journal-ai-report-actions">
          <button type="button" className="secondary" onClick={bumpNow}>
            <RefreshCw size={16} aria-hidden />
            {t(language, "journalAiReportRefresh")}
          </button>
          <button type="button" className="primary" onClick={() => void copyReport()}>
            <Copy size={16} aria-hidden />
            {t(language, "journalAiReportCopy")}
          </button>
        </div>
      </div>
      {statusText ? <p className={`journal-ai-report-status ${copyState === "err" ? "is-error" : "is-ok"}`}>{statusText}</p> : null}
      <label className="journal-ai-report-label" htmlFor="journal-ai-report-textarea">
        {t(language, "journalAiReportTextareaLabel")}
      </label>
      <textarea
        id="journal-ai-report-textarea"
        className="journal-ai-report-textarea"
        readOnly
        rows={18}
        value={reportMarkdown}
        spellCheck={false}
      />
    </div>
  );
}
