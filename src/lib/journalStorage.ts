export interface JournalData {
  byDay: Record<string, string>;
  byWeek: Record<string, string>;
  byMonth: Record<string, string>;
}

const STORAGE_KEY = "trading-journal-v1";

function emptyJournal(): JournalData {
  return { byDay: {}, byWeek: {}, byMonth: {} };
}

/** Journal aus Backup/JSON normalisieren (fehlende Felder → leer). */
export function normalizeJournalData(parsed: unknown): JournalData {
  if (!parsed || typeof parsed !== "object") return emptyJournal();
  const o = parsed as Record<string, unknown>;
  const pick = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  return {
    byDay: pick(o.byDay),
    byWeek: pick(o.byWeek),
    byMonth: pick(o.byMonth)
  };
}

export function loadJournalFromStorage(): JournalData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyJournal();
  try {
    return normalizeJournalData(JSON.parse(raw) as unknown);
  } catch {
    return emptyJournal();
  }
}

export function saveJournalToStorage(data: JournalData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
