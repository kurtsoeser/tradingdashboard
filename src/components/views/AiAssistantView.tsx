import { Route, Sparkles } from "lucide-react";
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

      <AiKnowledgeBaseCard language={language} value={aiKnowledgeBase} onChange={onAiKnowledgeBaseChange} />

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
    </section>
  );
}
