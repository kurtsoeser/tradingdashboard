# Trading Dashboard

Persönliches Trading-Dashboard als **reine Browser-App**. Alle Daten liegen **lokal auf deinem Gerät** (localStorage) — ohne Cloud, Login oder Supabase.

## Schnellstart

```bash
npm install
npm run dev
```

Öffne die angezeigte URL (typisch `http://localhost:5173`). **Keine `.env` nötig** — die früheren `VITE_SUPABASE_*`-Variablen werden nicht mehr verwendet. Du kannst sie aus `.env` entfernen.

Produktions-Build:

```bash
npm run build
npm run preview
```

## Datenspeicherung (localStorage)

| Inhalt | Schlüssel |
|--------|-----------|
| Trades | `trading-dashboard.trades.v2` |
| Basiswerte / Assets | `trading-dashboard.assets.meta.v1` |
| Trading-Journal | `trading-journal-v1` |
| KI-Wissensbasis | `trading-ai-knowledge-v1` |
| App-Einstellungen | `app-settings` |
| Theme | `theme` |
| TR-Import-Rohereignisse | `trading-dashboard.broker-events.v1` |
| Trades-Tabelle (Spalten) | `trades-columns-v1` |

Änderungen werden beim Bearbeiten direkt im Browser persistiert.

## Backup & Wiederherstellung

- **Export:** Einstellungen → JSON-Backup herunterladen (Trades, Assets, Journal, Einstellungen, Theme, KI-Text, optional Spaltenlayout).
- **Import:** dieselbe Datei unter Einstellungen importieren — ersetzt bzw. merged je nach Inhalt den lokalen Stand.

**Empfehlung:** Regelmäßig ein JSON-Backup sichern (z. B. auf Festplatte oder Cloud-Speicher deiner Wahl — unabhängig von dieser App).

## Umstieg von der früheren Cloud-Version

1. Falls du noch **nur Daten in Supabase** hast: einmal mit der **alten App-Version** einloggen, unter **Einstellungen** ein JSON-Backup exportieren, dann diese Version nutzen und das Backup importieren.
2. Wenn du die App **schon in diesem Browser** mit Cloud genutzt hast, sollten die Daten weiterhin in localStorage liegen und beim Start erscheinen.

Das frühere SQL-Schema und Migrations-Skripte lagen unter `supabase/` und wurden entfernt. Bei Bedarf findest du sie in der **Git-Historie** (Commits vor der Umstellung auf rein lokal).

## Deployment

GitHub Pages: Workflow unter `.github/workflows/deploy.yml` — baut statisch nach `dist/`. Jeder Besucher speichert **nur in seinem eigenen Browser**; es gibt keinen zentralen Server-Datenspeicher.

## Technik

- React 18, TypeScript, Vite
- Charts/Export: u. a. `xlsx`, `papaparse`
