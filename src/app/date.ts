export function toIsoMonth(datetimeValue: string): string {
  if (!datetimeValue) return "";
  const date = new Date(datetimeValue);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function toDisplayDateTime(datetimeValue: string): string {
  if (!datetimeValue) return "";
  const date = new Date(datetimeValue);
  if (Number.isNaN(date.getTime())) return "";
  const dd = `${date.getDate()}`.padStart(2, "0");
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${dd}.${mm}.${yyyy} - ${hh}.${min}`;
}

export function getNowLocalDateTimeValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function daysBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const deltaMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(deltaMs / (1000 * 60 * 60 * 24)));
}

export function parseStoredDateTime(value?: string): Date | null {
  if (!value || value === "-") return null;
  const normalized = value.trim();
  const [datePartRaw, timePartRaw] = normalized.includes(" - ")
    ? normalized.split(" - ")
    : normalized.split(" ");
  const datePart = datePartRaw?.trim();
  const timePart = timePartRaw?.trim();
  if (!datePart) return null;

  if (datePart.includes(".")) {
    const [d, m, y] = datePart.split(".");
    const day = Number.parseInt(d, 10);
    const month = Number.parseInt(m, 10) - 1;
    const year = Number.parseInt(y, 10);
    const timeNormalized = (timePart ?? "00:00").replace(".", ":");
    const [hh = "0", mm = "0"] = timeNormalized.split(":");
    const date = new Date(year, month, day, Number.parseInt(hh, 10), Number.parseInt(mm, 10));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (datePart.includes("/")) {
    const [m, d, y] = datePart.split("/");
    const month = Number.parseInt(m, 10) - 1;
    const day = Number.parseInt(d, 10);
    const yearRaw = Number.parseInt(y, 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const timeNormalized = (timePart ?? "00:00").replace(".", ":");
    const [hh = "0", mm = "0"] = timeNormalized.split(":");
    const date = new Date(year, month, day, Number.parseInt(hh, 10), Number.parseInt(mm, 10));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function formatDateTimeAT(value?: string): string {
  const date = parseStoredDateTime(value);
  if (!date) return value || "-";
  const dd = `${date.getDate()}`.padStart(2, "0");
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${dd}.${mm}.${yyyy} - ${hh}.${min}`;
}

export function toLocalInputValue(value?: string): string {
  const date = parseStoredDateTime(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const m = Number.parseInt(month, 10);
  const names = [
    "Januar",
    "Februar",
    "Maerz",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember"
  ];
  const monthName = names[m - 1] ?? monthKey;
  return `${monthName} ${year}`;
}

export function formatDashboardDateTime(date: Date): string {
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
