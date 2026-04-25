import { CandlestickChart, Clock3 } from "lucide-react";
import { getNowLocalDateTimeValue } from "../../app/date";
import { defaultForm, type NewTradeForm, type TradeFormType } from "../../app/types";
import { money } from "../../lib/analytics";
import type { Trade } from "../../types/trade";
import { PageHeader } from "../PageHeader";

interface NewTradeViewProps {
  editingTradeId: string | null;
  form: NewTradeForm;
  setForm: React.Dispatch<React.SetStateAction<NewTradeForm>>;
  statusClosed: boolean;
  gewinn: number;
  rendite: number;
  haltedauer: number;
  monat: string;
  onSaveNewTrade: () => void;
  onSetViewTrades: () => void;
  onCancelEdit: () => void;
}

export function NewTradeView({
  editingTradeId,
  form,
  setForm,
  statusClosed,
  gewinn,
  rendite,
  haltedauer,
  monat,
  onSaveNewTrade,
  onSetViewTrades,
  onCancelEdit
}: NewTradeViewProps) {
  return (
    <section className="section new-trade">
      <PageHeader
        title={editingTradeId ? "Trade bearbeiten" : "Neuer Trade"}
        subtitle={editingTradeId ? "Bearbeite den ausgewaehlten Trade" : "Erfasse einen neuen Trade"}
        actions={
          <button className="secondary" onClick={onSetViewTrades}>
            <CandlestickChart size={14} />
            Zu Trades
          </button>
        }
      />

      <div className="new-trade-grid">
        <div className="card form-card">
          <h3>Grunddaten</h3>
          <div className="form-grid">
            <label>
              Name *
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Gold - Long 4500"
              />
            </label>
            <label>
              Typ *
              <select value={form.typ} onChange={(e) => setForm((prev) => ({ ...prev, typ: e.target.value as TradeFormType }))}>
                <option value="Long">Long</option>
                <option value="Short">Short</option>
                <option value="Aktie">Aktie</option>
                <option value="Anleihe">Anleihe</option>
                <option value="Fond">Fond</option>
                <option value="Derivat">Derivat</option>
                <option value="Dividende">Dividende</option>
                <option value="Zinszahlung">Zinszahlung</option>
                <option value="Steuerkorrektur">Steuerkorrektur</option>
              </select>
            </label>
            <label>
              Basiswert *
              <input
                value={form.basiswert}
                onChange={(e) => setForm((prev) => ({ ...prev, basiswert: e.target.value }))}
                placeholder="z.B. Gold, Microsoft"
              />
            </label>
            <label>
              Kaufzeitpunkt *
              <div className="date-input-row">
                <input
                  type="datetime-local"
                  value={form.kaufzeitpunkt}
                  onChange={(e) => setForm((prev) => ({ ...prev, kaufzeitpunkt: e.target.value }))}
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="Aktuelle Zeit uebernehmen"
                  onClick={() => setForm((prev) => ({ ...prev, kaufzeitpunkt: getNowLocalDateTimeValue() }))}
                >
                  <Clock3 size={14} />
                </button>
              </div>
            </label>
            <label>
              Kaufpreis (EUR) *
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.kaufPreis}
                onChange={(e) => setForm((prev) => ({ ...prev, kaufPreis: e.target.value }))}
                placeholder="0,00"
              />
            </label>
            <label>
              Stueck
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.stueck}
                onChange={(e) => setForm((prev) => ({ ...prev, stueck: e.target.value }))}
                placeholder="Anzahl (optional)"
              />
            </label>
          </div>
        </div>

        <div className="card form-card">
          <div className="form-title-row">
            <h3>Verkauf / Abschluss</h3>
            <button
              className="ghost-btn"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  status: prev.status === "Offen" ? "Geschlossen" : "Offen",
                  verkaufszeitpunkt: prev.status === "Offen" && !prev.verkaufszeitpunkt ? getNowLocalDateTimeValue() : prev.verkaufszeitpunkt
                }))
              }
            >
              {statusClosed ? "Wieder oeffnen" : "Jetzt schliessen"}
            </button>
          </div>
          <div className="form-grid">
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Trade["status"] }))}>
                <option value="Offen">Offen</option>
                <option value="Geschlossen">Geschlossen</option>
              </select>
            </label>
            <label>
              Verkaufszeitpunkt
              <div className="date-input-row">
                <input
                  type="datetime-local"
                  value={form.verkaufszeitpunkt}
                  onChange={(e) => setForm((prev) => ({ ...prev, verkaufszeitpunkt: e.target.value }))}
                  disabled={!statusClosed}
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="Aktuelle Zeit uebernehmen"
                  onClick={() => setForm((prev) => ({ ...prev, verkaufszeitpunkt: getNowLocalDateTimeValue() }))}
                  disabled={!statusClosed}
                >
                  <Clock3 size={14} />
                </button>
              </div>
            </label>
            <label>
              Verkaufspreis (EUR)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.verkaufPreis}
                onChange={(e) => setForm((prev) => ({ ...prev, verkaufPreis: e.target.value }))}
                placeholder="0,00"
                disabled={!statusClosed}
              />
            </label>
            <label>
              Gewinn (EUR)
              <input value={money(gewinn)} disabled />
            </label>
            <label>
              Rendite (%)
              <input value={`${rendite.toFixed(2)}%`} disabled />
            </label>
            <label>
              Haltedauer (Tage)
              <input value={`${haltedauer}`} disabled />
            </label>
            <label>
              Monat
              <input value={monat} disabled />
            </label>
          </div>
        </div>
      </div>

      <div className="new-trade-actions">
        <button className="primary" onClick={onSaveNewTrade}>
          {editingTradeId ? "Aenderungen speichern" : "Speichern"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setForm(defaultForm());
            onCancelEdit();
          }}
        >
          Abbrechen
        </button>
      </div>
    </section>
  );
}
