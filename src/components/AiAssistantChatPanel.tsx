import { Loader2, MessageCircle, RefreshCw, RotateCcw, Send, Settings2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  onOpenSettings: () => void;
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

export function AiAssistantChatPanel({ language, settings, trades, journalData, onOpenSettings }: AiAssistantChatPanelProps) {
  const [contextRev, setContextRev] = useState(0);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const systemPrompt = useMemo(
    () => `${t(language, "aiChatSystemPreamble")}\n\n--- ${t(language, "aiChatDataSectionLabel")} ---\n\n${contextMarkdown}`,
    [language, contextMarkdown]
  );

  const provider = settings.aiProvider;

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

    try {
      const reply = await sendAiChatAssistantReply({
        provider,
        model: settings.aiModel,
        apiKey: settings.aiApiKey,
        backendUrl: settings.aiBackendUrl,
        system: systemPrompt,
        messages: nextMessages
      });
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

      <div className="ai-chat-messages" aria-live="polite">
        {messages.length === 0 && !loading ? (
          <p className="ai-chat-empty">{t(language, "chatAssistantEmptyState")}</p>
        ) : null}
        {messages.map((m, i) => (
          <div key={`${i}-${m.role}`} className={`ai-chat-bubble ai-chat-bubble-${m.role}`}>
            <span className="ai-chat-role">{m.role === "user" ? t(language, "chatAssistantRoleUser") : t(language, "chatAssistantRoleAssistant")}</span>
            <div className="ai-chat-bubble-body">{m.content}</div>
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

      <div className="ai-chat-composer">
        <textarea
          className="ai-chat-input"
          rows={3}
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
