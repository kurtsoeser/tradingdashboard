import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AppSettings } from "../app/settings";
import { t } from "../app/i18n";

const mdComponents: Partial<Components> = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="journal-md-table-scroll">
      <table className="journal-md-table">{children}</table>
    </div>
  )
};

interface JournalMarkdownFieldProps {
  language: AppSettings["language"];
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  placeholder: string;
  /** Optional: Vorschau-Karten-Titel (Standard: Journal-Notizen). */
  previewCardTitle?: string;
  /** Optional: Editor-Karten-Titel. */
  editingCardTitle?: string;
  /** Optional: Hinweis bei leerem Vorschau-Inhalt. */
  emptyPreviewHint?: string;
}

export function JournalMarkdownField({
  language,
  value,
  onChange,
  onBlur,
  placeholder,
  previewCardTitle,
  editingCardTitle,
  emptyPreviewHint
}: JournalMarkdownFieldProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const leaveEdit = () => {
    onBlur();
    setEditing(false);
  };

  return (
    <div className="journal-md-root">
      {!editing ? (
        <div className="journal-md-preview-card journal-md-preview-card--main">
          <div className="journal-md-card-head">
            <div className="journal-md-card-head-left">
              <span className="journal-md-card-title">{previewCardTitle ?? t(language, "journalNotesLabel")}</span>
              <span className="journal-md-badge">Markdown</span>
            </div>
            <button
              type="button"
              className="icon-btn journal-md-head-btn"
              aria-label={t(language, "journalMdEditPencilAria")}
              title={t(language, "journalMdEditPencilAria")}
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} />
            </button>
          </div>
          <div className="journal-md-preview journal-md" lang={language}>
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="journal-md-empty">{emptyPreviewHint ?? t(language, "journalMdPreviewEmpty")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="journal-md-editor-card">
          <div className="journal-md-card-head">
            <span className="journal-md-card-title">{editingCardTitle ?? t(language, "journalMdEditingTitle")}</span>
            <button
              type="button"
              className="icon-btn journal-md-head-btn journal-md-done-btn"
              aria-label={t(language, "journalMdDoneAria")}
              title={t(language, "journalMdDoneAria")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={leaveEdit}
            >
              <Check size={18} />
            </button>
          </div>
          <label className="journal-label journal-md-editor-label">
            <textarea
              ref={textareaRef}
              className="journal-textarea journal-md-textarea"
              rows={18}
              value={value}
              spellCheck
              onChange={(e) => onChange(e.target.value)}
              onBlur={leaveEdit}
              placeholder={placeholder}
            />
          </label>
        </div>
      )}
    </div>
  );
}
