export interface JournalData {
  byDay: Record<string, string>;
  byWeek: Record<string, string>;
  byMonth: Record<string, string>;
}

const STORAGE_KEY = "trading-journal-v1";

function emptyJournal(): JournalData {
  return { byDay: {}, byWeek: {}, byMonth: {} };
}

export function loadJournalFromStorage(): JournalData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyJournal();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyJournal();
    const o = parsed as Record<string, unknown>;
    const byDay = o.byDay && typeof o.byDay === "object" && !Array.isArray(o.byDay) ? (o.byDay as Record<string, string>) : {};
    const byWeek = o.byWeek && typeof o.byWeek === "object" && !Array.isArray(o.byWeek) ? (o.byWeek as Record<string, string>) : {};
    const byMonth = o.byMonth && typeof o.byMonth === "object" && !Array.isArray(o.byMonth) ? (o.byMonth as Record<string, string>) : {};
    return { byDay, byWeek, byMonth };
  } catch {
    return emptyJournal();
  }
}

export function saveJournalToStorage(data: JournalData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
