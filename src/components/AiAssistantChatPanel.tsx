import { BookMarked, CalendarDays, CalendarRange, Loader2, MessageCircle, RefreshCw, RotateCcw, Send, Settings2, Zap } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { getLocalizedQuickPrompts, LIVE_MARKET_BRIEFING_PROMPT_ID } from "../data/aiQuickPrompts";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { AiChatSendError, sendAiChatAssistantReply, type AiChatMessage } from "../lib/aiChatSend";
import { buildJournalAiReportMarkdownForSession } from "../lib/journalAiReportContext";
import type { JournalData } from "../lib/journalStorage";
import type { Trade } from "../types/trade";

interface AiAssistantChatPanelProps {
  language: AppSettings["language"];
  settings: AppSettings;
  trades: Trade[];
  journalData: JournalData;
  knowledgeBase: string;
  onOpenSettings: () => void;
  onOpenJournal: () => void;
  onAppendAiToJournal: (target: "day" | "week" | "month", markdown: string) => void;
}

function mapChatError(language: AppSettings["language"], err: unknown): string {
  if (err instanceof AiChatSendError) {
    const key =
      err.code === "NO_KEY"
        ? "aiChatErrorNoKey"
        : err.code === "NETWORK"
          ? "aiChatErrorNetwork"
          : err.code === "PARSE"
            ? "aiChatErrorParse"
            : err.code === "EMPTY"
              ? "aiChatErrorEmpty"
              : err.code === "PROXY"
                ? "aiChatErrorProxy"
                : "aiChatErrorHttp";
    const base = t(language, key);
    if (err.code === "HTTP" && err.message && err.message !== "HTTP") {
      return `${base}\n${err.message.slice(0, 600)}`;
    }
    return base;
  }
  return err instanceof Error ? err.message : t(language, "aiChatErrorNetwork");
}

export function AiAssistantChatPanel({
  language,
  settings,
  trades,
  journalData,
  knowledgeBase,
  onOpenSettings,
  onOpenJournal,
  onAppendAiToJournal
}: AiAssistantChatPanelProps) {
  const [contextRev, setContextRev] = useState(0);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickSelectReset, setQuickSelectReset] = useState(0);
  const [journalToast, setJournalToast] = useState<string | null>(null);
  /** Nächster Send: Gemini mit Google-Suche (Briefing-Schnellprompt oder Einstellung). */
  const geminiGroundingNextSendRef = useRef(false);

  const contextMarkdown = useMemo(
    () =>
      buildJournalAiReportMarkdownForSession({
        language,
        trades,
        journalData,
        now: new Date(),
        omitSuggestedPrompt: true
      }),
    [language, trades, journalData, contextRev]
  );

  const systemPrompt = useMemo(() => {
    const preamble = t(language, "aiChatSystemPreamble");
    const kb = knowledgeBase.trim();
    const kbBlock = kb
      ? `\n\n--- ${t(language, "aiChatKnowledgeUserSection")} ---\n\n${kb}`
      : "";
    const dataBlock = `\n\n--- ${t(language, "aiChatDataSectionLabel")} ---\n\n${contextMarkdown}`;
    return `${preamble}${kbBlock}${dataBlock}`;
  }, [language, contextMarkdown, knowledgeBase]);

  const provider = settings.aiProvider;

  const quickPrompts = useMemo(() => getLocalizedQuickPrompts(language), [language]);

  const insertQuickPrompt = useCallback((body: string, enableGeminiSearchGroundingForNextSend?: boolean) => {
    if (enableGeminiSearchGroundingForNextSend) geminiGroundingNextSendRef.current = true;
    setQuickSelectReset((k) => k + 1);
    setDraft((prev) => {
      const p = prev.trim();
      return p ? `${p}\n\n${body}` : body;
    });
  }, []);

  const pushAiToJournal = useCallback(
    (target: "day" | "week" | "month", markdown: string) => {
      onAppendAiToJournal(target, markdown);
      const key =
        target === "day"
          ? "chatAssistantJournalToastDay"
          : target === "week"
            ? "chatAssistantJournalToastWeek"
            : "chatAssistantJournalToastMonth";
      setJournalToast(t(language, key));
      window.setTimeout(() => setJournalToast(null), 4500);
    },
    [language, onAppendAiToJournal]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || loading) return;
    if (provider === "off") {
      setError(t(language, "aiChatErrorProviderOff"));
      return;
    }

    const nextMessages: AiChatMessage[] = [...messages, { role: "user", content: text }];
    setDraft("");
    setMessages(nextMessages);
    setLoading(true);
    setError(null);

    const hadGeminiGroundingOneShot = geminiGroundingNextSendRef.current;
    const useGeminiGrounding =
      provider === "google" &&
      (hadGeminiGroundingOneShot || settings.aiGeminiGoogleSearchGrounding);

    try {
      const reply = await sendAiChatAssistantReply({
        provider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        backendUrl: settings.aiBackendUrl,
        system: systemPrompt,
        messages: nextMessages,
        geminiGoogleSearchGrounding: useGeminiGrounding
      });
      if (hadGeminiGroundingOneShot) geminiGroundingNextSendRef.current = false;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(mapChatError(language, e));
    } finally {
      setLoading(false);
    }
  }, [
    draft,
    loading,
    provider,
    messages,
    settings.aiModel,
    settings.aiApiKey,
    settings.aiBackendUrl,
    settings.aiGeminiGoogleSearchGrounding,
    systemPrompt,
    language
  ]);

  if (provider === "off") {
    return (
      <div className="card ai-assistant-card ai-assistant-card-span ai-chat-panel">
        <h3>
          <MessageCircle size={16} aria-hidden />
          {t(language, "chatAssistantSectionTitle")}
        </h3>
        <p className="ai-assistant-prose">{t(language, "chatAssistantDisabledHint")}</p>
        <button type="button" className="secondary" onClick={onOpenSettings}>
          <Settings2 size={16} aria-hidden />
          {t(language, "chatAssistantOpenSettings")}
        </button>
      </div>
    );
  }

  return (
    <div className="card ai-assistant-card ai-assistant-card-span ai-chat-panel">
      <div className="ai-chat-head">
        <h3>
          <MessageCircle size={16} aria-hidden />
          {t(language, "chatAssistantSectionTitle")}
        </h3>
        <div className="ai-chat-toolbar">
          <button type="button" className="secondary slim" onClick={() => setContextRev((r) => r + 1)} disabled={loading}>
            <RefreshCw size={15} aria-hidden />
            {t(language, "chatAssistantRefreshContext")}
          </button>
          <button type="button" className="secondary slim" onClick={clearChat} disabled={loading}>
            <RotateCcw size={15} aria-hidden />
            {t(language, "chatAssistantClearChat")}
          </button>
          <button type="button" className="secondary slim" onClick={onOpenSettings}>
            <Settings2 size={15} aria-hidden />
            {t(language, "chatAssistantOpenSettings")}
          </button>
        </div>
      </div>
      <p className="ai-chat-hint">{t(language, "chatAssistantSectionHint")}</p>

      {journalToast ? (
        <div className="ai-chat-toast" role="status">
          <span>{journalToast}</span>
          <button type="button" className="secondary slim" onClick={onOpenJournal}>
            <BookMarked size={14} aria-hidden />
            {t(language, "chatAssistantJournalOpenJournal")}
          </button>
        </div>
      ) : null}

      <div className="ai-chat-messages" aria-live="polite">
        {messages.length === 0 && !loading ? (
          <p className="ai-chat-empty">{t(language, "chatAssistantEmptyState")}</p>
        ) : null}
        {messages.map((m, i) => (
          <div key={`${i}-${m.role}`} className={`ai-chat-bubble ai-chat-bubble-${m.role}`}>
            <span className="ai-chat-role">{m.role === "user" ? t(language, "chatAssistantRoleUser") : t(language, "chatAssistantRoleAssistant")}</span>
            <div className="ai-chat-bubble-body">{m.content}</div>
            {m.role === "assistant" ? (
              <div className="ai-chat-bubble-actions">
                <span className="ai-chat-bubble-actions-label">{t(language, "chatAssistantJournalActionsLabel")}</span>
                <button
                  type="button"
                  className="secondary slim ai-chat-journal-btn"
                  disabled={loading}
                  title={t(language, "chatAssistantJournalBtnDayTitle")}
                  onClick={() => pushAiToJournal("day", m.content)}
                >
                  <CalendarDays size={14} aria-hidden />
                  {t(language, "chatAssistantJournalBtnDay")}
                </button>
                <button
                  type="button"
                  className="secondary slim ai-chat-journal-btn"
                  disabled={loading}
                  title={t(language, "chatAssistantJournalBtnWeekTitle")}
                  onClick={() => pushAiToJournal("week", m.content)}
                >
                  <BookMarked size={14} aria-hidden />
                  {t(language, "chatAssistantJournalBtnWeek")}
                </button>
                <button
                  type="button"
                  className="secondary slim ai-chat-journal-btn"
                  disabled={loading}
                  title={t(language, "chatAssistantJournalBtnMonthTitle")}
                  onClick={() => pushAiToJournal("month", m.content)}
                >
                  <CalendarRange size={14} aria-hidden />
                  {t(language, "chatAssistantJournalBtnMonth")}
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="ai-chat-bubble ai-chat-bubble-assistant ai-chat-loading">
            <Loader2 size={18} className="ai-chat-spinner" aria-hidden />
            {t(language, "chatAssistantThinking")}
          </div>
        ) : null}
      </div>

      {error ? (
        <pre className="ai-chat-error" role="alert">
          {error}
        </pre>
      ) : null}

      <div className="ai-quick-prompts">
        <div className="ai-quick-head">
          <Zap size={15} aria-hidden />
          <span className="ai-quick-title">{t(language, "aiQuickSectionTitle")}</span>
        </div>
        <p className="ai-quick-hint">{t(language, "aiQuickSectionHint")}</p>
        <p className="ai-quick-hint ai-quick-hint-secondary">{t(language, "aiQuickLiveBriefingTechHint")}</p>
        <label className="ai-quick-select-wrap">
          <span className="ai-quick-select-label">{t(language, "aiQuickSelectLabel")}</span>
          <select
            key={quickSelectReset}
            className="ai-quick-select"
            aria-label={t(language, "aiQuickSelectLabel")}
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id || loading) return;
              const item = quickPrompts.find((p) => p.id === id);
              if (item) insertQuickPrompt(item.body, item.id === LIVE_MARKET_BRIEFING_PROMPT_ID);
            }}
          >
            <option value="">{t(language, "aiQuickSelectPlaceholder")}</option>
            {quickPrompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shortLabel}
              </option>
            ))}
          </select>
        </label>
        <div className="ai-quick-buttons" role="group" aria-label={t(language, "aiQuickSectionTitle")}>
          {quickPrompts.map((p) => (
            <button
              key={p.id}
              type="button"
              className="secondary slim ai-quick-btn"
              disabled={loading}
              title={p.shortLabel}
              onClick={() => insertQuickPrompt(p.body, p.id === LIVE_MARKET_BRIEFING_PROMPT_ID)}
            >
              {p.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-chat-composer">
        <textarea
          className="ai-chat-input"
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t(language, "chatAssistantPlaceholder")}
          disabled={loading}
          spellCheck
        />
        <button type="button" className="primary ai-chat-send" onClick={() => void send()} disabled={loading || !draft.trim()}>
          <Send size={16} aria-hidden />
          {t(language, "chatAssistantSend")}
        </button>
      </div>
    </div>
  );
}
