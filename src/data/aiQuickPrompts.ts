import type { AppSettings } from "../app/settings";

type Lang = AppSettings["language"];

export type QuickPromptDef = {
  id: string;
  shortLabel: Record<Lang, string>;
  body: Record<Lang, string>;
};

/**
 * Schnellprompts: nutzen den mitgeschickten Dashboard-Kontext (Trades, Journal, offene Positionen).
 * Kurzlabels für Buttons; gleicher Text im Auswahlmenü.
 */
export const AI_QUICK_PROMPTS: QuickPromptDef[] = [
  {
    id: "dailyReview",
    shortLabel: { de: "Tages-Review", en: "Daily review" },
    body: {
      de: `Führe ein kompaktes Tages-Review anhand der mitgelieferten Daten durch:
• Kurz: Ausgangslage (offene vs. geschlossene Aktivität heute)
• Trades heute: Muster, Größen, ggf. auffällige Symbole
• Σ P&L der heute geschlossenen Trades einordnen (ohne Schuldzuweisung)
• Drei Bullet-Listen: „Gut gelaufen“, „Verbessern“, „Für morgen / nächste Session“
Halte es knapp und handlungsorientiert.`,
      en: `Run a compact daily review from the data provided:
• Brief situation (open vs closed activity today)
• Today’s trades: patterns, size, notable symbols
• Put today’s closed-trade P&L in context (no blame)
• Three bullets each: “Went well”, “Improve”, “For tomorrow / next session”
Keep it short and actionable.`
    }
  },
  {
    id: "weekFocus",
    shortLabel: { de: "Woche & Fokus", en: "Week & focus" },
    body: {
      de: `Bewerte die laufende Kalenderwoche aus den Daten:
• Welche Basiswerte / Setups dominieren?
• Wo kam der realisierte P&L her (wenige prägnante Punkte)?
• Nenne 2–3 sinnvolle Fokus-Themen für den Rest der Woche (keine Preisprognosen).
• Stelle mir 2 Rückfragen, damit ich Prioritäten setzen kann.`,
      en: `Assess the current ISO week from the data:
• Which underlyings / setups dominated?
• Where did realized P&L come from (a few crisp points)?
• Suggest 2–3 focus themes for the rest of the week (no price predictions).
• Ask me 2 questions so I can set priorities.`
    }
  },
  {
    id: "openRisk",
    shortLabel: { de: "Offene Risiken", en: "Open risk" },
    body: {
      de: `Gehe alle offenen Positionen aus den Daten durch:
• Kurz pro Position: Kontext, Rolle im Portfolio (Größe in Worten), Haupt-Risiko
• Welche Korrelationen / Klumpenrisiken siehst du?
• Stelle mir 3 klärende Fragen zu Stops, Zeit-Horizont oder Exit-Logik (keine Order-Empfehlung).`,
      en: `Walk through every open position from the data:
• Briefly per line: context, portfolio role (size in words), main risk
• Any correlation / concentration risks?
• Ask me 3 clarifying questions on stops, horizon, or exit logic (no order advice).`
    }
  },
  {
    id: "nextSteps",
    shortLabel: { de: "Nächste Schritte", en: "Next steps" },
    body: {
      de: `Gib mir genau 5 konkrete, kurze nächste Schritte für heute bzw. diese Woche.
Jeder Schritt beginnt mit einem Verb (z. B. „Prüfen …“, „Eintragen …“, „Festlegen …“).
Keine Floskeln; beziehe dich auf offene Trades und Journal-Notizen, soweit sichtbar.`,
      en: `Give me exactly 5 concrete, short next steps for today or this week.
Each step starts with a verb (e.g. “Review…”, “Write down…”, “Define…”).
No fluff; tie to open trades and journal notes where visible.`
    }
  },
  {
    id: "rulesAudit",
    shortLabel: { de: "Regeln / Disziplin", en: "Rules / discipline" },
    body: {
      de: `Ich halte Regeln und Checklisten im Journal (Tages- und Wochennotizen).
Spiegele die sichtbaren Trades und offenen Positionen dagegen:
• mögliche Regelverletzungen oder Inkonsistenzen (sachlich, ohne Moralpredigt)
• was gut zur eigenen Planung passt
• 2 Vorschläge, wie ich Notizen nächste Woche schärfer machen kann`,
      en: `I keep rules and checklists in the journal (daily / weekly notes).
Reflect visible trades and open positions against that:
• possible rule breaks or inconsistencies (factual, no lecturing)
• what aligns well with the plan
• 2 suggestions to tighten my notes next week`
    }
  },
  {
    id: "sessionPrep",
    shortLabel: { de: "Session-Start", en: "Session prep" },
    body: {
      de: `Ich starte bald eine Handelssession.
Erstelle eine kurze Pre-Session-Checkliste (max. 10 Fragen), passend zu meinem aktuellen Portfolio und den heutigen Journal-Notizen.
Am Ende: eine Zeile „Top-3 Achtsamkeits-Punkte“ für die Session.`,
      en: `I’m about to start a trading session.
Create a short pre-session checklist (max 10 questions) tailored to my current portfolio and today’s journal notes.
End with one line: “Top 3 mindfulness points” for the session.`
    }
  },
  {
    id: "lessonsLearned",
    shortLabel: { de: "Lernpunkte", en: "Lessons" },
    body: {
      de: `Was sind die wichtigsten Lernpunkte aus den Daten der letzten Tage bzw. dieser Woche?
Struktur pro Punkt: Erkenntnis → kurzer Beleg aus den Daten → eine Verhaltens-Empfehlung für künftige Trades (keine Garantien).`,
      en: `What are the key lessons from the last days / this week in the data?
Per item: insight → brief evidence from the data → one behavior suggestion going forward (no guarantees).`
    }
  },
  {
    id: "stressBrainstorm",
    shortLabel: { de: "Risiko-Szenarien", en: "Risk scenarios" },
    body: {
      de: `Mach ein kurzes Worst-Case-Brainstorming zu meinen offenen Positionen:
• welche Risikodimensionen (Volatilität, Liquidität, Ereignisse, Korrelation) soll ich bewusst tragen?
Keine Kursprognosen; nur strukturierte Risiko-Fragen an mich und was ich vorbereiten sollte.`,
      en: `Short worst-case brainstorm for my open positions:
• which risk dimensions (volatility, liquidity, events, correlation) should I consciously carry?
No price targets; structured risk questions and what I should prepare.`
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
