import type { AppSettings } from "./settings";

let dateLocale = "de-AT";
let dateTimeZone = "Europe/Vienna";
let preferredDateFormat: AppSettings["dateFormat"] = "dd.MM.yyyy";

export function setDateDisplayConfig(config: { locale: string; timeZone: string; dateFormat: AppSettings["dateFormat"] }) {
  dateLocale = config.locale;
  dateTimeZone = config.timeZone;
  preferredDateFormat = config.dateFormat;
}

function formatDateParts(date: Date): string {
  if (preferredDateFormat === "yyyy-MM-dd") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: dateTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: dateTimeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

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
  const datePart = formatDateParts(date);
  const timePart = new Intl.DateTimeFormat(dateLocale, {
    timeZone: dateTimeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  return `${datePart} - ${timePart}`;
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
  const m = Number.parseInt(month, 10) - 1;
  const y = Number.parseInt(year, 10);
  if (Number.isNaN(m) || Number.isNaN(y)) return monthKey;
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: dateTimeZone,
    month: "long",
    year: "numeric"
  }).format(new Date(y, m, 1));
}

export function formatDashboardDateTime(date: Date): string {
  return `${formatDateParts(date)} ${new Intl.DateTimeFormat(dateLocale, { timeZone: dateTimeZone, hour: "2-digit", minute: "2-digit" }).format(date)}`;
}

function getPartsInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { weekday, hour, minute };
}

export function isMarketOpenNow(date: Date, exchange: AppSettings["exchange"] = "XETRA"): boolean {
  const exchangeConfig: Record<AppSettings["exchange"], { timeZone: string; openMinutes: number; closeMinutes: number }> = {
    XETRA: { timeZone: "Europe/Berlin", openMinutes: 9 * 60, closeMinutes: 17 * 60 + 30 },
    NYSE: { timeZone: "America/New_York", openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
    NASDAQ: { timeZone: "America/New_York", openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
    LSE: { timeZone: "Europe/London", openMinutes: 8 * 60, closeMinutes: 16 * 60 + 30 }
  };
  const cfg = exchangeConfig[exchange];
  const { weekday, hour, minute } = getPartsInTimezone(date, cfg.timeZone);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  if (day === 0 || day === 6) return false;
  const minutes = hour * 60 + minute;
  return minutes >= cfg.openMinutes && minutes < cfg.closeMinutes;
}

export function getCalendarMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: dateTimeZone,
    month: "long",
    year: "numeric"
  }).format(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getWeekdayNames(weekStartsOn: AppSettings["weekStartsOn"], language: AppSettings["language"]): string[] {
  const base = language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  if (weekStartsOn === "monday") return base;
  return [base[6], ...base.slice(0, 6)];
}
