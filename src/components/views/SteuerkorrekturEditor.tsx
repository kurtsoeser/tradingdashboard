import { Clock3, FileText, Landmark } from "lucide-react";
import { getNowLocalDateTimeValue } from "../../app/date";
import { t } from "../../app/i18n";
import type { NewTradeForm, TradeFormType } from "../../app/types";
import type { AppSettings } from "../../app/settings";
import { formatDecimalForForm, parseLocaleDecimal } from "../../lib/numberLocale";

function formatDateTimeDisplay(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dd = `${date.getDate()}`.padStart(2, "0");
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export interface SteuerkorrekturEditorProps {
  language: AppSettings["language"];
  form: NewTradeForm;
  setForm: React.Dispatch<React.SetStateAction<NewTradeForm>>;
  kaufzeitpunktDisplay: string;
  setKaufzeitpunktDisplay: (v: string) => void;
  commitKaufzeitpunktDisplay: () => void;
}

export function SteuerkorrekturEditor({
  language,
  form,
  setForm,
  kaufzeitpunktDisplay,
  setKaufzeitpunktDisplay,
  commitKaufzeitpunktDisplay
}: SteuerkorrekturEditorProps) {
  const loc = language === "en" ? "en" : "de";

  return (
    <div className="tax-correction-flow">
      <p className="muted tax-correction-intro">{t(language, "taxCorrectionIntro")}</p>

      <div className="card form-card tax-correction-card">
        <div className="card-title-row">
          <h3>{t(language, "taxCorrectionCardTitle")}</h3>
          <Landmark size={20} className="card-title-icon" />
        </div>
        <div className="form-grid tax-correction-grid">
          <label className="field-span-full">
            <span className="field-title">{t(language, "taxCorrectionNameLabel")}</span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t(language, "taxCorrectionNamePlaceholder")}
            />
          </label>

          <label className="field-span-full">
            <span className="field-title">{t(language, "source")}</span>
            <select
              value={form.sourceBroker}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sourceBroker: e.target.value as "TRADE_REPUBLIC" | "N26" | "BAWAG" | "MANUAL"
                }))
              }
            >
              <option value="MANUAL">Manuell</option>
              <option value="TRADE_REPUBLIC">Trade Republic</option>
              <option value="N26">N26</option>
              <option value="BAWAG">BAWAG</option>
            </select>
          </label>

          <label className="field-span-full">
            <span className="field-title">{t(language, "taxCorrectionDateLabel")}</span>
            <div className="date-input-row">
              <input
                type="text"
                value={kaufzeitpunktDisplay}
                onChange={(e) => setKaufzeitpunktDisplay(e.target.value)}
                onBlur={commitKaufzeitpunktDisplay}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitKaufzeitpunktDisplay();
                  }
                }}
                placeholder={t(language, "datePlaceholder")}
              />
              <button
                type="button"
                className="icon-btn"
                title={t(language, "useNow")}
                onClick={() => {
                  const nowValue = getNowLocalDateTimeValue();
                  setForm((prev) => ({ ...prev, kaufzeitpunkt: nowValue }));
                  setKaufzeitpunktDisplay(formatDateTimeDisplay(nowValue));
                }}
              >
                <Clock3 size={14} />
              </button>
            </div>
          </label>

          <label className="field-span-full">
            <span className="field-title">{t(language, "taxCorrectionAmountLabel")}</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.verkaufSteuern}
              onChange={(e) => setForm((prev) => ({ ...prev, verkaufSteuern: e.target.value }))}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  setForm((prev) => ({ ...prev, verkaufSteuern: "" }));
                  return;
                }
                const p = parseLocaleDecimal(raw, loc);
                if (p === null) {
                  setForm((prev) => ({ ...prev, verkaufSteuern: "" }));
                  return;
                }
                setForm((prev) => ({ ...prev, verkaufSteuern: formatDecimalForForm(p, loc) }));
              }}
              placeholder={loc === "de" ? "0,00" : "0.00"}
            />
            <span className="muted tax-correction-amount-hint">{t(language, "taxCorrectionAmountHint")}</span>
          </label>

          <label className="field-span-full notes-label tax-correction-notes">
            <span className="field-title">{t(language, "notesField")}</span>
            <textarea
              value={form.notiz}
              onChange={(e) => setForm((prev) => ({ ...prev, notiz: e.target.value }))}
              placeholder={t(language, "notesPlaceholder")}
              rows={3}
            />
          </label>

          <label className="field-span-full">
            <span className="field-title">{t(language, "taxCorrectionSwitchTypeLabel")}</span>
            <select
              value={form.typ}
              onChange={(e) => setForm((prev) => ({ ...prev, typ: e.target.value as TradeFormType }))}
            >
              <option value="Steuerkorrektur">Steuerkorrektur</option>
              <option value="Long">Long</option>
              <option value="Short">Short</option>
              <option value="Aktie">Aktie</option>
              <option value="Anleihe">Anleihe</option>
              <option value="Fond">Fond</option>
              <option value="Derivat">Derivat</option>
              <option value="Dividende">Dividende</option>
              <option value="Zinszahlung">Zinszahlung</option>
            </select>
            <span className="muted tax-correction-switch-hint">{t(language, "taxCorrectionSwitchTypeHint")}</span>
          </label>
        </div>
      </div>

      <div className="card form-card tax-correction-hint-card">
        <div className="card-title-row">
          <h3>{t(language, "taxCorrectionSavedHintTitle")}</h3>
          <FileText size={20} className="card-title-icon" />
        </div>
        <p className="muted">{t(language, "taxCorrectionSavedHintBody")}</p>
      </div>
    </div>
  );
}
