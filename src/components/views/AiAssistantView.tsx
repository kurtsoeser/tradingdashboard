import { BookMarked, Sparkles } from "lucide-react";
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
}

export function AiAssistantView({ language, settings, trades, journalData, onOpenJournal, onOpenSettings }: AiAssistantViewProps) {
  const useItems = [
    t(language, "aiAssistantUse1"),
    t(language, "aiAssistantUse2"),
    t(language, "aiAssistantUse3"),
    t(language, "aiAssistantUse4"),
    t(language, "aiAssistantUse5"),
    t(language, "aiAssistantUse6")
  ];
  const roadItems = [
    t(language, "aiAssistantRoad1"),
    t(language, "aiAssistantRoad2"),
    t(language, "aiAssistantRoad3"),
    t(language, "aiAssistantRoad4"),
    t(language, "aiAssistantRoad5")
  ];
  const techItems = [
    t(language, "aiAssistantTech1"),
    t(language, "aiAssistantTech2"),
    t(language, "aiAssistantTech3"),
    t(language, "aiAssistantTech4"),
    t(language, "aiAssistantTech5")
  ];
  const secItems = [t(language, "aiAssistantSec1"), t(language, "aiAssistantSec2"), t(language, "aiAssistantSec3")];

  return (
    <section className="section ai-assistant-page">
      <PageHeader
        title={
          <>
            <Sparkles size={18} />
            {t(language, "aiAssistantTitle")}
          </>
        }
        subtitle={t(language, "aiAssistantSubtitle")}
        actions={
          <span className="ai-assistant-badge" role="status">
            {t(language, "aiAssistantBadge")}
          </span>
        }
      />

      <AiAssistantChatPanel
        language={language}
        settings={settings}
        trades={trades}
        journalData={journalData}
        onOpenSettings={onOpenSettings}
      />

      <div className="ai-assistant-grid">
        <article className="card ai-assistant-card">
          <h3>{t(language, "aiAssistantCardVisionTitle")}</h3>
          <div className="ai-assistant-prose">
            <p>{t(language, "aiAssistantCardVisionP1")}</p>
            <p>{t(language, "aiAssistantCardVisionP2")}</p>
            <p>{t(language, "aiAssistantCardVisionP3")}</p>
          </div>
        </article>

        <article className="card ai-assistant-card">
          <h3>{t(language, "aiAssistantCardUseTitle")}</h3>
          <ul className="ai-assistant-list">
            {useItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card ai-assistant-card ai-assistant-card-span">
          <h3>{t(language, "aiAssistantCardTechTitle")}</h3>
          <ol className="ai-assistant-list ai-assistant-list-numbered">
            {techItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="card ai-assistant-card">
          <h3>{t(language, "aiAssistantCardSecurityTitle")}</h3>
          <ul className="ai-assistant-list">
            {secItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card ai-assistant-card">
          <h3>{t(language, "aiAssistantCardRoadmapTitle")}</h3>
          <ol className="ai-assistant-list ai-assistant-list-numbered">
            {roadItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="card ai-assistant-card ai-assistant-cta-card">
          <h3>
            <BookMarked size={15} aria-hidden />
            {t(language, "aiAssistantCtaHeading")}
          </h3>
          <p className="ai-assistant-prose">{t(language, "aiAssistantCtaJournalHint")}</p>
          <button type="button" className="primary" onClick={onOpenJournal}>
            <BookMarked size={16} aria-hidden />
            {t(language, "aiAssistantCtaJournal")}
          </button>
        </article>
      </div>
    </section>
  );
}
