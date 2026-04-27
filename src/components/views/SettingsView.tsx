import { Bell, Building2, CalendarClock, GitMerge, Globe2, Hash, Languages, Settings2, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "../PageHeader";
import type { I18nKey } from "../../app/i18n";
import type { AppSettings } from "../../app/settings";

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (next: AppSettings) => void;
  onApplyTheme: (theme: "dark" | "light") => void;
  currentTheme: "dark" | "light";
  t: (key: I18nKey) => string;
  /** Einmalig fehlende Ticker aus kurierter Liste ergänzen (nur leeres Ticker-Feld). */
  onApplyKnownTickerSuggestions?: () => void;
  knownTickerSuggestionCount?: number;
  /** Dubletten (z. B. Dell / Dell Technologies) per Regelwerk zusammenführen. */
  onMergeDuplicateBasiswerte?: () => void;
  basiswertMergePreview?: { tradeRenames: number; metaCollapses: number };
  reconcileRows?: Array<{
    id: string;
    kind: "trade" | "asset";
    label: string;
    basiswert: string;
    currentIsin?: string;
    currentWkn?: string;
    suggestion?: { isin?: string; wkn?: string; source: string; confidence: number };
    status: "ok" | "missing" | "uncertain";
  }>;
  onApplyReconcileSuggestion?: (rowId: string) => void;
  onApplyAllReconcileSuggestions?: () => void;
}

export function SettingsView({
  settings,
  onSettingsChange,
  onApplyTheme,
  currentTheme,
  t,
  onApplyKnownTickerSuggestions,
  knownTickerSuggestionCount,
  onMergeDuplicateBasiswerte,
  basiswertMergePreview,
  reconcileRows,
  onApplyReconcileSuggestion,
  onApplyAllReconcileSuggestions
}: SettingsViewProps) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <section className="section settings-page">
      <PageHeader
        title={
          <>
            <Settings2 size={18} />
            Einstellungen
          </>
        }
        subtitle="Passe App-Verhalten, Anzeige und Marktpräferenzen an"
      />

      <div className="settings-grid">
        <div className="card settings-card">
          <h3>
            <Wallet size={14} />
            Region & Währung
          </h3>
          <div className="settings-form-grid">
            <label>
              Währung
              <select value={settings.currency} onChange={(e) => update("currency", e.target.value as AppSettings["currency"])}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="CHF">CHF</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <label>
              Zeitzone
              <select value={settings.timezone} onChange={(e) => update("timezone", e.target.value as AppSettings["timezone"])}>
                <option value="Europe/Vienna">Europe/Vienna</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </label>
            <label>
              Sprache
              <select value={settings.language} onChange={(e) => update("language", e.target.value as AppSettings["language"])}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {settings.language === "en" ? "Fees (default) buy" : "Gebühren (Standard) Kauf"}
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.defaultBuyFees}
                onChange={(e) => update("defaultBuyFees", Number.parseFloat(e.target.value) || 0)}
              />
            </label>
            <label>
              {settings.language === "en" ? "Fees (default) sell" : "Gebühren (Standard) Verkauf"}
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.defaultSellFees}
                onChange={(e) => update("defaultSellFees", Number.parseFloat(e.target.value) || 0)}
              />
            </label>
          </div>
        </div>

        <div className="card settings-card">
          <h3>
            <Building2 size={14} />
            Markt & Börse
          </h3>
          <div className="settings-form-grid">
            <label>
              Standard-Börse
              <select value={settings.exchange} onChange={(e) => update("exchange", e.target.value as AppSettings["exchange"])}>
                <option value="XETRA">XETRA</option>
                <option value="NYSE">NYSE</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="LSE">LSE</option>
              </select>
            </label>
            <label>
              Standard-Finanz-Service
              <select value={settings.financeService} onChange={(e) => update("financeService", e.target.value as AppSettings["financeService"])}>
                <option value="google">Google Finance</option>
                <option value="yahoo">Yahoo Finance</option>
                <option value="tradingview">TradingView</option>
                <option value="investing">Investing.com</option>
              </select>
            </label>
            <label className="settings-toggle">
              <span>
                <Bell size={14} />
                {t("marketStatusPulse")}
              </span>
              <input type="checkbox" checked={settings.showMarketPulse} onChange={(e) => update("showMarketPulse", e.target.checked)} />
            </label>
            <label>
              Wochenstart
              <select value={settings.weekStartsOn} onChange={(e) => update("weekStartsOn", e.target.value as AppSettings["weekStartsOn"])}>
                <option value="monday">Montag</option>
                <option value="sunday">Sonntag</option>
              </select>
            </label>
          </div>
        </div>

        {onApplyKnownTickerSuggestions && (
          <div className="card settings-card">
            <h3>
              <Hash size={14} />
              Basiswert-Ticker (Vorschlag)
            </h3>
            <p className="settings-ticker-enrich-hint">
              Ergänzt fehlendes <strong>Ticker</strong>-Feld für deine Basiswerte aus den Trades — nur wenn der Name zu einer kuratierten Liste passt (
              {knownTickerSuggestionCount ?? "…"} Einträge). Bereits gesetzte Ticker werden nicht überschrieben.
            </p>
            <button type="button" className="secondary" onClick={onApplyKnownTickerSuggestions}>
              Bekannte Ticker jetzt übernehmen
            </button>
          </div>
        )}

        {onMergeDuplicateBasiswerte && (
          <div className="card settings-card">
            <h3>
              <GitMerge size={14} />
              Basiswert-Dubletten
            </h3>
            <p className="settings-ticker-enrich-hint">
              Gleicht <strong>Basiswert</strong>-Namen in allen Trades an ein gemeinsames Kürzel an (z. B. „Dell“ → „Dell Technologies“, „Palantir“ →
              „Palantir Technologies“) und führt doppelte Einträge in den gespeicherten Basiswert-Metadaten zusammen. Läuft beim App-Start automatisch; der
              Button wendet dieselbe Logik erneut an (z. B. nach Import).
            </p>
            <p className="muted-help" style={{ marginTop: "0.35rem" }}>
              Aktuell erkannt: ca.{" "}
              <strong>{basiswertMergePreview?.tradeRenames ?? 0}</strong> Trade-Zeilen mit abweichendem Textfeld,{" "}
              <strong>{basiswertMergePreview?.metaCollapses ?? 0}</strong> zusätzliche Meta-Zeilen pro Basiswert-Gruppe.
            </p>
            <button type="button" className="secondary" onClick={onMergeDuplicateBasiswerte}>
              Dubletten jetzt zusammenführen
            </button>
          </div>
        )}

        {reconcileRows && onApplyReconcileSuggestion && (
          <div className="card settings-card">
            <h3>
              <Hash size={14} />
              ISIN/WKN-Abgleich
            </h3>
            <p className="settings-ticker-enrich-hint">
              Scannt alle Trades und Basiswerte, markiert fehlende oder unsichere ISINs und schlägt Zuordnungen mit Quelle + Confidence vor.
            </p>
            <p className="muted-help" style={{ marginTop: "0.35rem" }}>
              Offen: <strong>{reconcileRows.filter((r) => r.status !== "ok").length}</strong> von <strong>{reconcileRows.length}</strong> Datensätzen.
            </p>
            {onApplyAllReconcileSuggestions && (
              <button type="button" className="secondary" onClick={onApplyAllReconcileSuggestions} style={{ marginBottom: "0.75rem" }}>
                Alle Vorschläge übernehmen
              </button>
            )}
            <div className="symbol-hit-table-wrap">
              <table className="symbol-hit-table">
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>Name</th>
                    <th>Aktuell</th>
                    <th>Vorschlag</th>
                    <th>Status</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileRows
                    .filter((row) => row.status !== "ok")
                    .slice(0, 120)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{row.kind === "trade" ? "Trade" : "Basiswert"}</td>
                        <td>
                          <div className="symbol-hit-name">
                            <strong>{row.label}</strong>
                            <div className="symbol-hit-type">{row.basiswert}</div>
                          </div>
                        </td>
                        <td>
                          ISIN: <code>{row.currentIsin || "—"}</code>
                          <br />
                          WKN: <code>{row.currentWkn || "—"}</code>
                        </td>
                        <td>
                          ISIN: <code>{row.suggestion?.isin || "—"}</code>
                          <br />
                          WKN: <code>{row.suggestion?.wkn || "—"}</code>
                          <div className="symbol-hit-type">
                            {row.suggestion ? `${row.suggestion.source} · ${Math.round(row.suggestion.confidence * 100)}%` : "Kein Vorschlag"}
                          </div>
                        </td>
                        <td>{row.status === "missing" ? "Fehlend" : "Unsicher"}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary slim"
                            onClick={() => onApplyReconcileSuggestion(row.id)}
                            disabled={!row.suggestion?.isin && !row.suggestion?.wkn}
                          >
                            Übernehmen
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card settings-card">
          <h3>
            <CalendarClock size={14} />
            Darstellung
          </h3>
          <div className="settings-form-grid">
            <label>
              Datumsformat
              <select value={settings.dateFormat} onChange={(e) => update("dateFormat", e.target.value as AppSettings["dateFormat"])}>
                <option value="dd.MM.yyyy">dd.MM.yyyy</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd</option>
              </select>
            </label>
            <label>
              Zahlenformat
              <select value={settings.numberFormat} onChange={(e) => update("numberFormat", e.target.value as AppSettings["numberFormat"])}>
                <option value="de-DE">de-DE (1.234,56)</option>
                <option value="en-US">en-US (1,234.56)</option>
              </select>
            </label>
            <label>
              Startansicht
              <select value={settings.defaultStartView} onChange={(e) => update("defaultStartView", e.target.value as AppSettings["defaultStartView"])}>
                <option value="dashboard">Dashboard</option>
                <option value="trades">Trades</option>
                <option value="assets">Assets</option>
                <option value="analytics">Auswertungen</option>
                <option value="journal">Journal</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card settings-card">
          <h3>
            <ShieldCheck size={14} />
            Verhalten
          </h3>
          <div className="settings-form-grid">
            <label className="settings-toggle">
              <span>
                <Globe2 size={14} />
                Kompakter Modus
              </span>
              <input type="checkbox" checked={settings.compactMode} onChange={(e) => update("compactMode", e.target.checked)} />
            </label>
            <label className="settings-toggle">
              <span>
                <Languages size={14} />
                Löschen bestätigen
              </span>
              <input type="checkbox" checked={settings.confirmBeforeDelete} onChange={(e) => update("confirmBeforeDelete", e.target.checked)} />
            </label>
            <label>
              Theme
              <select onChange={(e) => onApplyTheme(e.target.value as "dark" | "light")} value={currentTheme}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <p className="muted-help">
        Hinweis: Diese Seite ist als Einstellungszentrale vorbereitet. Felder werden bereits gespeichert; die schrittweise Anwendung auf alle Teilbereiche kann danach gezielt erfolgen.
      </p>
    </section>
  );
}
