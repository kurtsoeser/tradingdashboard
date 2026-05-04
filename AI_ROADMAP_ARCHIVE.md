# KI-Roadmap Archivnotiz

Diese Notiz archiviert die bisherigen Inhalte der Seite `KI · Konzept & Roadmap`, nachdem der Menüpunkt aus der Navigation entfernt wurde.

## Zielbild

- Der Assistent soll Portfolio-Daten, optional Journal und Strategie-Notizen kennen und kontextbezogen antworten.
- Typische Modi: Tages-Review, Wochenplanung, Risiko-Check, Regel-Abgleich, strukturierte Reflexion nach Trades.
- KI liefert Ideen und Struktur, aber keine automatisierten Anlageentscheidungen.
- Tonalität und Disclaimer klar halten (kein Ersatz für professionelle Beratung).

## Starke Anwendungsfälle

1. Kurze Performance-Zusammenfassung aus Trades plus Journal (heute / Woche).
2. Offene Positionen gegen im Journal hinterlegte Regeln/Checklisten spiegeln.
3. Aus Kennzahlen (Winrate, Timing, Basiswerte) konkrete nächste Schritte ableiten.
4. Trade-Notizen strukturieren, Risiken benennen, Follow-ups ableiten (ohne Order-Ausführung).
5. Begriffe/Setups im Kontext der eigenen Dashboard-Einträge erklären.
6. Bestehenden Markdown-KI-Bericht aus dem Journal als Startkontext wiederverwenden.

## Technik (Architektur)

1. Chat-UI in React: Verlauf, Eingabe, optional Streaming.
2. Provider-Schicht mit gemeinsamem Interface (Messages, Modell-ID, Temperatur), z. B. Gemini / Anthropic / OpenAI-kompatibel.
3. API-Keys bei gehosteter App nur serverseitig über Backend/Proxy; lokal optional Direktmodus, aber nie Keys im Source.
4. Kontext gezielt bauen: KPIs, aggregierte Trades, Journal-Markdown; Tokenbudget und Datenschutz beachten.
5. Perspektivisch optionale Tools/Funktionsaufrufe (z. B. read-only KPI-Abfragen), Schreibzugriffe nur mit expliziter Bestätigung.

## Sicherheit & Compliance

1. Keys verschlüsselt/isoliert speichern, nur HTTPS, keine Keys in Git oder Client-Bundles.
2. Keine Broker-Orders aus der KI ohne separates, gehärtetes Modul.
3. Provider-Regeln zu Speicherung/Training von Prompts prüfen; Zero-Retention bevorzugen.

## Mögliche Umsetzungsschritte

1. Einstellungen: Anbieter, Modell-ID, API-Key, optional Proxy-URL.
2. MVP-Chat: ein Thread, Systemprompt mit Dashboard-Kontext, "Kontext aktualisieren".
3. Streaming und robuste Fehleranzeige (429, Netzwerk, ungültiger Key).
4. Optional Kosten-/Token-Hinweise pro Anfrage.
5. Später: lokal gespeicherte Chats und Schnellaktionen ("Heute reviewen", "Offene Risiken").

## Übergang bis In-App-Chat

- Bis der eingebaute Chat live ist, kann der Markdown-Bericht aus dem Journal in externe Modelle (z. B. Gemini, Claude, Copilot) eingefügt werden.

---

Quelle der Inhalte: i18n-Keys rund um `aiAssistant*` / `aiAssistantRoad*` in `src/app/i18n.ts` (de/en).
