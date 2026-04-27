import { ChevronDown, ChevronRight, Library, Route, Sparkles } from "lucide-react";
import { useState } from "react";
import { AiKnowledgeBaseCard } from "../AiKnowledgeBaseCard";
import { AiAssistantChatPanel } from "../AiAssistantChatPanel";
import { PageHeader } from "../PageHeader";
import { t } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";
import type { JournalData } from "../../lib/journalStorage";
import type { Trade } from "../../types/trade";

interface AiAssistantViewProps {
  language: AppSettings["language"];
  settings: AppSettings;
  trades: Trade[];
  journalData: JournalData;
  onOpenJournal: () => void;
  onOpenSettings: () => void;
  onOpenAiRoadmap: () => void;
  onAppendAiToJournal: (target: "day" | "week" | "month", markdown: string) => void;
  aiKnowledgeBase: string;
  onAiKnowledgeBaseChange: (text: string) => void;
}

export function AiAssistantView({
  language,
  settings,
  trades,
  journalData,
  onOpenJournal,
  onOpenSettings,
  onOpenAiRoadmap,
  onAppendAiToJournal,
  aiKnowledgeBase,
  onAiKnowledgeBaseChange
}: AiAssistantViewProps) {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  return (
    <section className="section ai-assistant-page ai-assistant-main-page">
      <PageHeader
        title={
          <>
            <Sparkles size={18} />
            {t(language, "aiAssistantTitle")}
          </>
        }
        subtitle={t(language, "aiAssistantPageCleanSubtitle")}
        actions={
          <button type="button" className="secondary" onClick={onOpenAiRoadmap}>
            <Route size={16} aria-hidden />
            {t(language, "aiAssistantOpenRoadmap")}
          </button>
        }
      />

      <AiAssistantChatPanel
        language={language}
        settings={settings}
        trades={trades}
        journalData={journalData}
        knowledgeBase={aiKnowledgeBase}
        onOpenSettings={onOpenSettings}
        onOpenJournal={onOpenJournal}
        onAppendAiToJournal={onAppendAiToJournal}
      />

      <div className="ai-assistant-knowledge-section">
        <button
          type="button"
          id="ai-assistant-knowledge-toggle"
          className="ai-assistant-knowledge-toggle"
          aria-expanded={knowledgeOpen}
          aria-controls="ai-assistant-knowledge-panel"
          onClick={() => setKnowledgeOpen((o) => !o)}
        >
          {knowledgeOpen ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
          <Library size={16} aria-hidden />
          <span className="ai-assistant-knowledge-toggle-label">{t(language, "aiKnowledgeCardTitle")}</span>
        </button>
        {knowledgeOpen ? (
          <div
            id="ai-assistant-knowledge-panel"
            className="ai-assistant-knowledge-panel-body"
            role="region"
            aria-labelledby="ai-assistant-knowledge-toggle"
          >
            <p className="ai-assistant-knowledge-toggle-intro">{t(language, "aiKnowledgeCardSubtitle")}</p>
            <AiKnowledgeBaseCard language={language} value={aiKnowledgeBase} onChange={onAiKnowledgeBaseChange} compactTitle />
          </div>
        ) : null}
      </div>
    </section>
  );
}
