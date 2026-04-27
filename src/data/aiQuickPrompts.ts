import type { AppSettings } from "../app/settings";

type Lang = AppSettings["language"];

export type QuickPromptDef = {
  id: string;
  shortLabel: Record<Lang, string>;
  body: Record<Lang, string>;
};

/** ID des Schnellprompts „Markt-Briefing (Live)“ — löst bei Gemini optional Google-Suche aus. */
export const LIVE_MARKET_BRIEFING_PROMPT_ID = "liveMarketBriefing" as const;

/**
 * Schnellprompts: nutzen den mitgeschickten Dashboard-Kontext (Trades, Journal, offene Positionen).
 * Kurzlabels für Buttons; gleicher Text im Auswahlmenü.
 * Bodies sind ausführlich formuliert, damit das Modell strukturiert antwortet und nur den mitgelieferten Kontext nutzt.
 */
export const AI_QUICK_PROMPTS: QuickPromptDef[] = [
  {
    id: "dailyReview",
    shortLabel: { de: "Tages-Review", en: "Daily review" },
    body: {
      de: `Führe ein **kompaktes Tages-Review** ausschließlich auf Basis des Markdown-Blocks „Dashboard-Daten“ (Überblick, Journal heute, Trades heute, ggf. offene Positionen).

**Regeln**
• Verwende nur Fakten, Symbole, Beträge und Zeiten, die dort stehen. Wenn eine Sektion leer oder nicht vorhanden ist, sage das in einem Satz — nichts erfinden.
• Keine Kursziele, keine Order-Empfehlungen, keine verbindliche Anlageberatung.

**Antwortstruktur** (Markdown, knapp)
1. **Ausgangslage (1 Absatz):** Stand laut Daten; Verhältnis offene vs. heute geschlossene Aktivität nur soweit aus den Einträgen erkennbar.
2. **Trades heute:** Stichpunkte — Muster (z. B. Richtung, wiederkehrende Basiswerte), relative Größenordnung, auffällige Symbole/Namen nur wenn genannt.
3. **P&L heute:** Summe bzw. Einzelrealisierungen nur aus den angegebenen Zahlen; sachlich einordnen (ohne Schuldzuweisung).
4. Drei nummerierte Listen mit je **max. 4** Punkten:
   - Gut gelaufen
   - Verbessern
   - Für die nächste Session / morgen
5. **Eine Zeile Fazit:** der wichtigste Hebel für die nächste Session.

Ziel: unter **400 Wörter**, handlungsorientiert.`,
      en: `Run a **compact daily review** using only the “Dashboard data” markdown block (overview, today’s journal, today’s trades, open positions if present).

**Rules**
• Use only symbols, amounts, and times that appear there. If a section is empty or missing, say so in one sentence — do not invent.
• No price targets, no order instructions, no binding investment advice.

**Answer structure** (Markdown, tight)
1. **Situation (1 paragraph):** per data; open vs closed today only as evidenced.
2. **Today’s trades:** bullets — patterns (direction, recurring underlyings), rough size sense, notable symbols/names only if listed.
3. **Today’s P&L:** only from stated numbers; neutral framing (no blame).
4. Three numbered lists with **max 4** bullets each:
   - Went well
   - Improve
   - Next session / tomorrow
5. **One-line takeaway:** the single highest-leverage focus next.

Target: **under 400 words**, actionable.`
    }
  },
  {
    id: "weekFocus",
    shortLabel: { de: "Woche & Fokus", en: "Week & focus" },
    body: {
      de: `Bewerte die **aktuelle Kalenderwoche** nur anhand „Dashboard-Daten“ (Wochen-Trades, Wochen-Journal, Überblick, offene Positionen).

**Regeln**
• Nenne konkrete Basiswerte, Trade-Namen oder Kennzahlen nur, wenn sie im Text vorkommen.
• Keine Preisprognosen oder Markt-Timing-Versprechen.

**Antwortstruktur**
1. **Wochen-Snapshot (3–5 Stichpunkte):** Volumen/Mix der Woche, dominante Basiswerte oder Setups — mit kurzem Beleg aus den Daten (z. B. „X in Y von Z Trades“ nur wenn so ableitbar).
2. **Realisierter P&L:** woher er kommt (konzise Cluster: z. B. wenige Symbole oder wenige größere Trades) — nur aus den gelieferten Zahlen.
3. **2–3 Fokus-Themen** für den Rest der Woche: jeweils ein Satz „Thema → warum (Datenbezug) → was ich beobachten soll“ — ohne Handlungsanweisungen zum Markt.
4. **Genau 2 Rückfragen** an mich (nummeriert), die mir helfen, Prioritäten zu setzen (z. B. Risikobudget, Zeit, Lernziel).

Max. **350 Wörter**.`,
      en: `Assess the **current ISO week** using only “Dashboard data” (week trades, week journal, overview, open positions).

**Rules**
• Name underlyings, trade labels, or figures only if they appear in the text.
• No price predictions or timing guarantees.

**Answer structure**
1. **Week snapshot (3–5 bullets):** volume/mix, dominant underlyings or setups — with brief evidence from the data (counts only if derivable).
2. **Realized P&L:** where it came from (tight clusters: few symbols or few larger trades) — numbers from the block only.
3. **2–3 focus themes** for the rest of the week: each one line “theme → why (data tie) → what to watch” — no market directives.
4. **Exactly 2 numbered questions** for me to set priorities (e.g. risk budget, time, learning goal).

Max **350 words**.`
    }
  },
  {
    id: "openRisk",
    shortLabel: { de: "Offene Risiken", en: "Open risk" },
    body: {
      de: `Analysiere **alle offenen Positionen** aus der Sektion „Offene Positionen“ / „Open positions“ im Dashboard-Daten-Block.

**Regeln**
• Wenn keine offenen Positionen gelistet sind: eine klare Meldung und stattdessen 3 allgemeine Reflexionsfragen zu Risiko-Disziplin (ohne auf fiktive Trades zu verweisen).
• Keine Empfehlung für konkrete Orders, Stops oder Hedge-Produkte.

**Antwortstruktur** (wenn Positionen vorhanden)
• **Tabelle oder Liste:** eine Zeile pro Position mit Spalten: Name/Symbol · Rolle im Portfolio (Größe in Worten: klein/mittel/groß relativ zu den anderen offenen) · Haupt-Risiko (1 Satz, sachlich).
• **Klumpen & Korrelation:** Absatz zu offensichtlicher Konzentration (gleicher Basiswert, gleiche Branche, gleiche Richtung) — nur wenn aus den Daten erkennbar.
• **Genau 3 Rückfragen** (nummeriert) zu Stops, Zeithorizont oder Exit-Logik — als Klärungsfragen an mich, keine Anweisungen.

Klar und scanbar; **unter 450 Wörter**.`,
      en: `Analyze **every open position** from the “Open positions” section in the Dashboard data block.

**Rules**
• If none are listed: state that clearly and offer 3 general discipline reflection questions (do not reference fictional trades).
• No concrete order, stop, or hedge recommendations.

**Answer structure** (when positions exist)
• **Table or list:** one row per position: name/symbol · portfolio role (small/medium/large vs other opens) · main risk (one factual sentence).
• **Concentration & correlation:** paragraph on obvious clustering (same underlying, sector, direction) — only if visible from the data.
• **Exactly 3 numbered clarifying questions** on stops, horizon, or exit logic — questions to me, not instructions.

Scannable; **under 450 words**.`
    }
  },
  {
    id: "nextSteps",
    shortLabel: { de: "Nächste Schritte", en: "Next steps" },
    body: {
      de: `Gib mir **genau 5** nächste Schritte für **heute oder diese Woche**, abgeleitet aus Dashboard-Daten (offene Trades, Journal-Tages-/Wochennotizen, heutige/wöchentliche Realisierungen).

**Regeln**
• Jeder Schritt **beginnt mit einem Verb** (z. B. „Prüfen …“, „Eintragen …“, „Festlegen …“).
• Pro Schritt: **eine Zeile Aufgabe** + optional **eine Zeile Erfolgskriterium** („Erledigt, wenn …“) — beides kurz.
• Beziehe dich auf sichtbare Symbole, Notizen oder offene Positionen; wenn etwas fehlt, formuliere den Schritt als „Daten ergänzen / klären“ statt zu raten.
• Keine Floskeln, keine Motivationssprüche.

Nummerierte Liste **1.–5.** Max. **120 Wörter** gesamt.`,
      en: `Give me **exactly 5** next steps for **today or this week** derived from Dashboard data (open trades, day/week journal notes, today’s/week’s realized activity).

**Rules**
• Each step **starts with a verb** (e.g. “Review…”, “Log…”, “Define…”).
• Per step: **one line task** + optional **one line done-when** — both short.
• Tie to visible symbols, notes, or opens; if data is missing, phrase as “fill in / clarify” instead of guessing.
• No fluff or pep talk.

Numbered **1–5.** Max **120 words** total.`
    }
  },
  {
    id: "rulesAudit",
    shortLabel: { de: "Regeln / Disziplin", en: "Rules / discipline" },
    body: {
      de: `Ich dokumentiere Regeln und Checklisten im **Journal** (Tages- und Wochennotizen im Dashboard-Daten-Block).

**Aufgabe**
Vergleiche **sichtbare Trades** (heute + Woche) und **offene Positionen** mit dem, was in den Journal-Texten explizit steht (Regeln, Vorhaben, Checklisten, Stimmung — nur was dort wörtlich oder klar als Plan erkennbar ist).

**Regeln**
• Keine Moralpredigt; sachlich und respektvoll.
• Wenn im Journal kaum Regeln stehen: sage das und schlage vor, **welche 3 Infos** ich künftig in den Notizen festhalten sollte, damit ein solcher Audit möglich wird.

**Antwortstruktur**
1. **Übereinstimmung (Stichpunkte):** wo Verhalten und Notizen zusammenpassen — mit Bezug auf konkrete Einträge nur wenn vorhanden.
2. **Mögliche Inkonsistenzen oder Lücken (Stichpunkte):** neutral formuliert; pro Punkt kurz „Beobachtung → was unklar bleibt“.
3. **Genau 2 Vorschläge**, wie ich **nächste Woche** Notizen schärfer machen kann (z. B. feste Felder: Setup, Risiko, Abbruchbedingung).

**unter 400 Wörter**.`,
      en: `I keep rules and checklists in the **journal** (day and week notes in the Dashboard data block).

**Task**
Compare **visible trades** (today + week) and **open positions** with what the journal text explicitly states (rules, intentions, checklists, mood — only what is written or clearly a plan).

**Rules**
• No lecturing; factual and respectful.
• If the journal barely contains rules: say so and suggest **3 pieces of info** to log so this audit works later.

**Answer structure**
1. **Alignment (bullets):** where behavior and notes match — cite entries only when present.
2. **Possible gaps or inconsistencies (bullets):** neutral; each “observation → what stays unclear”.
3. **Exactly 2 suggestions** to make **next week’s** notes sharper (e.g. fixed fields: setup, risk, abort condition).

**Under 400 words**.`
    }
  },
  {
    id: "sessionPrep",
    shortLabel: { de: "Session-Start", en: "Session prep" },
    body: {
      de: `Ich starte **bald eine Handelssession**. Nutze nur „Dashboard-Daten“ (Überblick, offene Positionen, Journal heute, Trades heute).

**Lieferumfang**
1. **Pre-Session-Checkliste:** **max. 10** kurze Ja/Nein- oder Ein-Wort-Fragen, **streng personalisiert** auf meine aktuellen offenen Positionen und die heutigen Journal-Notizen (wenn leer: allgemeine Disziplin-Checks, aber erwähne die Lücke).
2. **Top-3 Achtsamkeits-Punkte** für die Session: eine kompakte Zeile mit drei durch „ · “ getrennten Stichworten/Satzfragmenten (kein Essay).

Keine Marktprognose. Keine Order-Vorschläge. **unter 250 Wörter**.`,
      en: `I’m **about to start a trading session**. Use only “Dashboard data” (overview, open positions, today’s journal, today’s trades).

**Deliverables**
1. **Pre-session checklist:** **max 10** short yes/no or one-word questions, **strictly tailored** to my current opens and today’s journal (if empty: general discipline checks and note the gap).
2. **Top 3 mindfulness points** for the session: one compact line, three fragments separated by “ · ” (no essay).

No market forecast. No order ideas. **Under 250 words**.`
    }
  },
  {
    id: "lessonsLearned",
    shortLabel: { de: "Lernpunkte", en: "Lessons" },
    body: {
      de: `Extrahiere die **wichtigsten Lernpunkte** aus den Dashboard-Daten der **letzten Tage bzw. aktuellen Woche** (Wochen-Trades, Tages-Trades, Journal, offene vs. geschlossene Aktivität).

**Regeln**
• **Max. 5** Lernpunkte; wenn weniger Daten: weniger Punkte, dafür ehrlich „Datenlage dünn“.
• Keine Garantien für künftige Ergebnisse.

**Pro Lernpunkt** exakt dieses Mini-Format (Markdown):
- **Erkenntnis:** ein Satz.
- **Beleg:** ein Satz mit Bezug auf konkrete Einträge/Zahlen aus den Daten (oder „kein direkter Beleg im Text“).
- **Verhalten:** ein Satz — eine sinnvolle Gewohnheit für künftige Trades (keine Kauf/Verkauf-Anweisung).

**unter 450 Wörter**.`,
      en: `Extract the **key lessons** from Dashboard data for the **last days / current week** (week trades, day trades, journal, open vs closed activity).

**Rules**
• **Max 5** lessons; if data is thin, fewer items and say “data is thin”.
• No guarantees of future outcomes.

**Per lesson** use exactly this mini-format (Markdown):
- **Insight:** one sentence.
- **Evidence:** one sentence tied to specific entries/figures (or “no direct evidence in text”).
- **Behavior:** one sentence — one useful habit for future trades (no buy/sell instructions).

**Under 450 words**.`
    }
  },
  {
    id: "stressBrainstorm",
    shortLabel: { de: "Risiko-Szenarien", en: "Risk scenarios" },
    body: {
      de: `**Worst-Case-Brainstorming** zu meinen **offenen Positionen** (nur aus „Dashboard-Daten“; wenn keine offenen: kurz mitteilen und 5 generische Risiko-Dimensionen für spätere Sessions nennen — ohne fiktive Positionen).

**Ziel:** strukturiertes Nachdenken, keine Kursprognosen.

**Antwortstruktur** (wenn offene Positionen existieren)
• **Pro Position** (oder gruppiert bei sehr ähnlichen Basiswerten): **3–5 Zeilen** im Muster  
  *Risiko-Dimension* (z. B. Volatilität, Liquidität, Ereignis, Korrelation, Zeit/Theta) → **was schiefgehen könnte** (qualitativ) → **eine Frage an mich** („Hast du X bedacht?“).
• Abschluss: **5 kurze Vorbereitungs-Prompts** (Was sollte ich vor der Session klären / dokumentiert haben?) — wieder ohne Order-Empfehlung.

**unter 500 Wörter**, scanbar.`,
      en: `**Worst-case brainstorm** for my **open positions** (Dashboard data only; if none: say so and list 5 generic risk dimensions for future sessions — no fictional positions).

**Goal:** structured thinking, no price forecasts.

**Answer structure** (when opens exist)
• **Per position** (or grouped if same underlying): **3–5 lines** each:  
  *risk dimension* (e.g. volatility, liquidity, event, correlation, time/decay) → **what could go wrong** (qualitative) → **one question for me** (“Have you considered X?”).
• Close with **5 short prep prompts** (what to clarify or log before session) — still no order advice.

**Under 500 words**, scannable.`
    }
  },
  {
    id: LIVE_MARKET_BRIEFING_PROMPT_ID,
    shortLabel: { de: "Markt-Briefing (Live)", en: "Market briefing (live)" },
    body: {
      de: `**Aktuelles Markt-Briefing** zu meinen **offenen Positionen** aus dem Block „Dashboard-Daten“ (Basiswert, Name, Typ, Stück — nur was dort steht).

**Quellen & Live-Daten**
• Nutze **aktuelle Web-Recherche** (Nachrichten, Unternehmens-/Branchenmeldungen, relevante Marktkontexte), soweit du dazu in der Lage bist.
• Nenne die **wichtigsten Quellen** kurz (Medium + Datum bzw. Link), keine erfundenen URLs.
• **Keine verbindliche Anlageberatung**, keine Order-/Stop-Empfehlungen, keine garantierten Kursziele. Max. **1–2 Sätze** pro Position als **persönliche Reflexion / mögliche nächste Prüfschritte** (z. B. „Earnings im Kalender prüfen“, „Sektor-Korrelation beobachten“).

**Inhalt**
1. **Kurzüberblick (2–4 Sätze):** was bei den genannten Basiswerten in den letzten Tagen/Stunden medial bzw. marktrelevant auffällt.
2. **Pro offener Position** (oder sinnvoll gruppiert): **News & Fakten** (stichpunktartig) → **Peers / verwandte Titel** (z. B. bei Nvidia: AMD, TSMC, SMCI, Sektor-Semi) — was tun diese / die Branche laut aktueller Berichterstattung?
3. **Querschnitt:** Korrelationen oder gemeinsame Themen über meine offenen Zeilen hinweg.
4. **Abschluss:** **genau zwei Sätze** — Fazit + vorsichtige Handlungsorientierung (Journal/Research, keine Kauf-/Verkaufsanweisung).

Wenn **kein Live-Webzugriff** verfügbar ist: sag das in **einem Satz** und liefere stattdessen eine **konkrete Such-Checkliste** (Suchbegriffe + welche offiziellen IR-/News-Seiten ich öffnen soll), ohne aktuelle Zahlen zu erfinden.

Ziel: **unter 650 Wörter**, scanbar, überwiegend Deutsch.`,
      en: `**Current market briefing** for my **open positions** from the “Dashboard data” block (underlying, name, type, size — only what is listed).

**Sources & live data**
• Use **current web research** (news, company/sector items, relevant market context) when your environment allows.
• Cite **key sources** briefly (outlet + date or link); do not invent URLs.
• **No binding investment advice**, no order/stop instructions, no guaranteed price targets. **At most 1–2 sentences** per line as **personal reflection / possible next checks** (e.g. “check earnings calendar”, “watch sector correlation”).

**Content**
1. **Short overview (2–4 sentences):** what stands out recently for the named underlyings.
2. **Per open position** (or grouped sensibly): **news & facts** (bullets) → **peers / related names** (e.g. Nvidia: AMD, TSMC, SMCI, semis) — what are they / the sector doing per current reporting?
3. **Cross-cut:** correlations or shared themes across my open lines.
4. **Close:** **exactly two sentences** — takeaway + cautious orientation (journal/research, not buy/sell).

If **no live web** is available: say so in **one sentence** and give a **concrete search checklist** (queries + which official IR/news pages to open) without inventing current figures.

Target: **under 650 words**, scannable.`
    }
  }
];

export function getLocalizedQuickPrompts(language: Lang): { id: string; shortLabel: string; body: string }[] {
  return AI_QUICK_PROMPTS.map((p) => ({
    id: p.id,
    shortLabel: p.shortLabel[language],
    body: p.body[language]
  }));
}
