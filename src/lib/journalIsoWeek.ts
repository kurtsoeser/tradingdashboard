/** ISO 8601 Kalenderwoche (Mo–So), lokale Datumslogik */

export function getIsoWeekYearAndWeek(d: Date): { isoYear: number; week: number } {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { isoYear: date.getFullYear(), week: Math.max(1, Math.min(53, week)) };
}

export function toIsoWeekKey(d: Date): string {
  const { isoYear, week } = getIsoWeekYearAndWeek(d);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function parseIsoWeekKey(key: string): { isoYear: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const isoYear = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(isoYear) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  return { isoYear, week };
}

/** Montag 00:00 lokal der angegebenen ISO-KW */
export function mondayOfIsoWeek(isoYear: number, week: number): Date {
  const t = new Date(isoYear, 0, 4);
  const dow = t.getDay() || 7;
  const mondayWeek1 = new Date(t);
  mondayWeek1.setDate(t.getDate() - dow + 1);
  const monday = new Date(mondayWeek1);
  monday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function sundayOfIsoWeek(isoYear: number, week: number): Date {
  const mon = mondayOfIsoWeek(isoYear, week);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(0, 0, 0, 0);
  return sun;
}

export function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDaysLocal(d: Date, delta: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + delta);
  return next;
}
