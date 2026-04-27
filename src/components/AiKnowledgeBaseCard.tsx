import { Library } from "lucide-react";
import { t } from "../app/i18n";
import type { AppSettings } from "../app/settings";
import { JournalMarkdownField } from "./JournalMarkdownField";

interface AiKnowledgeBaseCardProps {
  language: AppSettings["language"];
  value: string;
  onChange: (next: string) => void;
  /** Ohne Kopfzeile (Titel/Untertitel), wenn die Sektion außen per Chevron beschriftet ist. */
  compactTitle?: boolean;
}

export function AiKnowledgeBaseCard({ language, value, onChange, compactTitle = false }: AiKnowledgeBaseCardProps) {
  return (
    <div className={`card ai-assistant-card ai-assistant-card-span ai-knowledge-card${compactTitle ? " ai-knowledge-card--compact" : ""}`}>
      {!compactTitle ? (
        <div className="ai-knowledge-head">
          <h3>
            <Library size={16} aria-hidden />
            {t(language, "aiKnowledgeCardTitle")}
          </h3>
          <p className="ai-knowledge-sub">{t(language, "aiKnowledgeCardSubtitle")}</p>
        </div>
      ) : null}
      <JournalMarkdownField
        language={language}
        value={value}
        onChange={onChange}
        onBlur={() => {}}
        placeholder={t(language, "aiKnowledgePlaceholder")}
        previewCardTitle={t(language, "aiKnowledgePreviewCardTitle")}
        editingCardTitle={t(language, "aiKnowledgeEditingTitle")}
        emptyPreviewHint={t(language, "aiKnowledgeEmptyHint")}
      />
      <p className="ai-knowledge-foot">{t(language, "aiKnowledgeInjectHint")}</p>
    </div>
  );
}
