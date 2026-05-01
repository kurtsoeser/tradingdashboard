/** DE: `1.234,56` oder `12,5`; EN: `1,234.56` oder `12.5` */
export function parseLocaleDecimal(raw: string, locale: "de" | "en"): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s || s === "-" || s === "+") return null;

  const sign = s.startsWith("-") ? -1 : 1;
  const body = s.replace(/^[-+]/, "");
  if (!body) return null;

  let normalized: string;
  if (locale === "de") {
    const lastComma = body.lastIndexOf(",");
    const lastDot = body.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = body.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > lastComma) {
      normalized = body.replace(/,/g, "");
    } else if (body.includes(",")) {
      normalized = body.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = body;
    }
  } else {
    const lastComma = body.lastIndexOf(",");
    const lastDot = body.lastIndexOf(".");
    if (lastDot > lastComma) {
      normalized = body.replace(/,/g, "");
    } else if (lastComma > lastDot) {
      normalized = body.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = body.replace(/,/g, "");
    }
  }

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return sign < 0 ? -Math.abs(n) : n;
}

/** Anzeige im Eingabefeld (ohne Tausenderpunkte, Dezimalkomma DE). */
export function formatDecimalForForm(n: number, locale: "de" | "en"): string {
  if (!Number.isFinite(n)) return "";
  if (locale === "de") {
    return new Intl.NumberFormat("de-AT", {
      maximumFractionDigits: 8,
      useGrouping: false
    }).format(n);
  }
  return String(n);
}
