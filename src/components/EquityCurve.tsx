import { useMemo, useState, type MouseEvent } from "react";
import { RotateCcw } from "lucide-react";
import type { AppSettings } from "../app/settings";
import { t } from "../app/i18n";
import type { Trade } from "../types/trade";
import { getTradeRealizedPL, isTradeClosed, money } from "../lib/analytics";

type Grouping = "day" | "week" | "month" | "year";

interface EquityPoint {
  key: string;
  label: string;
  date: Date;
  pl: number;
  cumulative: number;
}

interface EquityTooltip {
  x: number;
  y: number;
  label: string;
  pl: number;
  cumulative: number;
}

function parseTradeDate(value?: string): Date | null {
  if (!value || value === "-") return null;

  const datePart = value.split(" ")[0];

  if (datePart.includes("/")) {
    const parts = datePart.split("/");
    if (parts.length === 3) {
      const month = Number.parseInt(parts[0], 10) - 1;
      const day = Number.parseInt(parts[1], 10);
      const yearRaw = Number.parseInt(parts[2], 10);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  if (datePart.includes(".")) {
    const parts = datePart.split(".");
    if (parts.length === 3) {
      const day = Number.parseInt(parts[0], 10);
      const month = Number.parseInt(parts[1], 10) - 1;
      const yearRaw = Number.parseInt(parts[2], 10);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}

function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDateInput(s: string): Date | null {
  if (!s) return null;
  const parts = s.split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay));
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupKey(date: Date, grouping: Grouping): { key: string; label: string; bucketDate: Date } {
  if (grouping === "year") {
    return {
      key: `${date.getFullYear()}`,
      label: `${date.getFullYear()}`,
      bucketDate: new Date(date.getFullYear(), 0, 1)
    };
  }

  if (grouping === "month") {
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const key = `${date.getFullYear()}-${month}`;
    const bucketDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const label = `${month}/${date.getFullYear().toString().slice(-2)}`;
    return { key, label, bucketDate };
  }

  if (grouping === "week") {
    const weekStart = startOfWeek(date);
    const month = `${weekStart.getMonth() + 1}`.padStart(2, "0");
    const day = `${weekStart.getDate()}`.padStart(2, "0");
    const key = `${weekStart.getFullYear()}-${month}-${day}`;
    const label = `${day}.${month}.`;
    return { key, label, bucketDate: weekStart };
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const key = `${date.getFullYear()}-${month}-${day}`;
  const label = `${day}.${month}.`;
  return { key, label, bucketDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()) };
}

function buildPoints(trades: Trade[], grouping: Grouping): EquityPoint[] {
  const buckets = new Map<string, { label: string; date: Date; pl: number }>();
  const closed = trades.filter((trade) => isTradeClosed(trade));

  closed.forEach((trade) => {
    const date = parseTradeDate(trade.verkaufszeitpunkt) ?? parseTradeDate(trade.kaufzeitpunkt);
    if (!date) return;
    const amount = getTradeRealizedPL(trade);
    const grouped = groupKey(date, grouping);
    const current = buckets.get(grouped.key);
    if (!current) {
      buckets.set(grouped.key, { label: grouped.label, date: grouped.bucketDate, pl: amount });
    } else {
      current.pl += amount;
    }
  });

  let cumulative = 0;
  return [...buckets.entries()]
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([key, value]) => {
      cumulative += value.pl;
      return {
        key,
        label: value.label,
        date: value.date,
        pl: value.pl,
        cumulative
      };
    });
}

function tradesInEquityDateRange(trades: Trade[], fromIso: string, toIso: string): Trade[] {
  const hasFilter = Boolean(fromIso || toIso);
  if (!hasFilter) return trades;

  const parsedFrom = fromIso ? parseIsoDateInput(fromIso) : null;
  const parsedTo = toIso ? parseIsoDateInput(toIso) : null;
  if (fromIso && !parsedFrom) return trades;
  if (toIso && !parsedTo) return trades;

  const fromD = parsedFrom ? startOfDay(parsedFrom) : null;
  const toD = parsedTo ? endOfDay(parsedTo) : null;

  return trades.filter((trade) => {
    if (!isTradeClosed(trade)) return false;
    const cd = parseTradeDate(trade.verkaufszeitpunkt) ?? parseTradeDate(trade.kaufzeitpunkt);
    if (!cd) return false;
    const ts = cd.getTime();
    if (fromD && ts < fromD.getTime()) return false;
    if (toD && ts > toD.getTime()) return false;
    return true;
  });
}

function pickYStep(span: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1000;
  if (span < 20) return 2;
  if (span < 80) return 10;
  if (span < 200) return 20;
  if (span < 800) return 100;
  if (span < 3000) return 250;
  if (span < 12000) return 1000;
  if (span < 30000) return 2000;
  if (span < 70000) return 5000;
  return 10000;
}

const PRESET_DAYS = [7, 30, 90, 365] as const;
type PresetKey = `days${(typeof PRESET_DAYS)[number]}`;

export function EquityCurve({
  trades,
  language
}: {
  trades: Trade[];
  language: AppSettings["language"];
}) {
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [tooltip, setTooltip] = useState<EquityTooltip | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showBars, setShowBars] = useState(true);
  const [showCurve, setShowCurve] = useState(true);

  const hasAnyClosed = useMemo(() => trades.some((x) => isTradeClosed(x)), [trades]);

  const dateBounds = useMemo(() => {
    let minT = Infinity;
    let maxT = -Infinity;
    for (const trade of trades) {
      if (!isTradeClosed(trade)) continue;
      const d = parseTradeDate(trade.verkaufszeitpunkt) ?? parseTradeDate(trade.kaufzeitpunkt);
      if (!d) continue;
      const t = d.getTime();
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    if (!Number.isFinite(minT)) return { minIso: "", maxIso: "" };
    return { minIso: toIsoDateString(new Date(minT)), maxIso: toIsoDateString(new Date(maxT)) };
  }, [trades]);

  const scopedTrades = useMemo(
    () => tradesInEquityDateRange(trades, dateFrom, dateTo),
    [trades, dateFrom, dateTo]
  );

  const points = useMemo(() => buildPoints(scopedTrades, grouping), [scopedTrades, grouping]);

  const applyPresetDays = (days: number) => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    setDateFrom(toIsoDateString(start));
    setDateTo(toIsoDateString(end));
  };

  const clearDateRange = () => {
    setDateFrom("");
    setDateTo("");
  };

  const toggleBars = (next: boolean) => {
    if (!next && !showCurve) return;
    setShowBars(next);
  };

  const toggleCurve = (next: boolean) => {
    if (!next && !showBars) return;
    setShowCurve(next);
  };

  const resetView = () => {
    setDateFrom("");
    setDateTo("");
    setGrouping("day");
    setShowBars(true);
    setShowCurve(true);
    setTooltip(null);
  };

  if (!hasAnyClosed) {
    return (
      <div className="equity-empty card">{t(language, "equityEmptyNoClosed")}</div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="equity-card card">
        <div className="equity-head">
          <div>
            <h3>{t(language, "equityTitle")}</h3>
            <p>{t(language, "equityChartHint")}</p>
          </div>
        </div>
        <EquityToolbar
          language={language}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearRange={clearDateRange}
          onPresetDays={applyPresetDays}
          dateMin={dateBounds.minIso}
          dateMax={dateBounds.maxIso}
        />
        <div className="equity-empty">{t(language, "equityEmptyNoRange")}</div>
        <EquityDisplayControls
          language={language}
          grouping={grouping}
          onGroupingChange={setGrouping}
          showBars={showBars}
          showCurve={showCurve}
          onToggleBars={toggleBars}
          onToggleCurve={toggleCurve}
        />
      </div>
    );
  }

  const width = 1120;
  const height = 420;
  const margin = { top: 30, right: 70, bottom: 58, left: 84 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const allValues: number[] = [0];
  if (showBars) {
    for (const p of points) allValues.push(p.pl);
  }
  if (showCurve) {
    for (const p of points) allValues.push(p.cumulative);
  }

  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yStep = pickYStep(yMax - yMin);
  const domainMin = Math.floor(Math.min(yMin, 0) / yStep) * yStep;
  const domainMax = Math.ceil(Math.max(yMax, 0) / yStep) * yStep;
  const safeDomainMin = domainMin === domainMax ? domainMin - yStep : domainMin;
  const safeDomainMax = domainMin === domainMax ? domainMax + yStep : domainMax;
  const scaleY = (value: number) =>
    margin.top + ((safeDomainMax - value) / (safeDomainMax - safeDomainMin || 1)) * innerH;
  const scaleX = (index: number) => margin.left + index * step;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(index)} ${scaleY(point.cumulative)}`)
    .join(" ");

  const zeroY = scaleY(0);
  const barWidth = Math.max(6, Math.min(16, step * 0.55));
  const last = points[points.length - 1];
  const xTickEvery = Math.ceil(points.length / 18);
  const yTicks: { value: number; y: number }[] = [];
  for (let value = safeDomainMax; value >= safeDomainMin - 1e-9; value -= yStep) {
    yTicks.push({
      value,
      y: scaleY(value)
    });
  }
  const showTooltip = (event: MouseEvent<SVGElement>, point: EquityPoint) => {
    const svg = event.currentTarget.closest("svg");
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    setTooltip({
      x: event.clientX - box.left + 12,
      y: event.clientY - box.top - 14,
      label: point.label,
      pl: point.pl,
      cumulative: point.cumulative
    });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <div className="equity-card card">
      <div className="equity-head">
        <div>
          <h3>{t(language, "equityTitle")}</h3>
          <p>{t(language, "equityChartHint")}</p>
        </div>
        <button
          type="button"
          className="equity-reset-btn"
          title={t(language, "reset")}
          aria-label={t(language, "reset")}
          onClick={resetView}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <EquityToolbar
        language={language}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClearRange={clearDateRange}
        onPresetDays={applyPresetDays}
        dateMin={dateBounds.minIso}
        dateMax={dateBounds.maxIso}
      />

      <div className="equity-chart-wrap">
        <svg
          className="equity-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t(language, "equityAriaChart")}
          onMouseLeave={hideTooltip}
        >
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={height - margin.bottom}
            className="equity-axis-line"
          />
          {yTicks.map((tick) => (
            <g key={`y-${tick.value}`}>
              <line
                x1={margin.left}
                y1={tick.y}
                x2={width - margin.right}
                y2={tick.y}
                className="equity-grid-line"
              />
              <text x={margin.left - 14} y={tick.y + 4} className="equity-y-label">
                {money(tick.value)}
              </text>
            </g>
          ))}

          <line x1={margin.left} y1={zeroY} x2={width - margin.right} y2={zeroY} className="equity-zero-line" />

          {showBars
            ? points.map((point, index) => {
                const x = scaleX(index) - barWidth / 2;
                const y = point.pl >= 0 ? scaleY(point.pl) : zeroY;
                const h = Math.abs(scaleY(point.pl) - zeroY);
                return (
                  <rect
                    key={`bar-${point.key}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(1, h)}
                    rx={2}
                    className={point.pl >= 0 ? "equity-bar-win" : "equity-bar-loss"}
                    onMouseEnter={(event) => showTooltip(event, point)}
                    onMouseMove={(event) => showTooltip(event, point)}
                    onMouseLeave={hideTooltip}
                  />
                );
              })
            : null}

          {showCurve ? (
            <>
              <path d={linePath} className="equity-line-area" />
              <path d={linePath} className="equity-line" />
            </>
          ) : null}

          {showCurve
            ? points.map((point, index) => (
                <circle
                  key={`dot-${point.key}`}
                  cx={scaleX(index)}
                  cy={scaleY(point.cumulative)}
                  r={3}
                  className="equity-dot"
                  onMouseEnter={(event) => showTooltip(event, point)}
                  onMouseMove={(event) => showTooltip(event, point)}
                  onMouseLeave={hideTooltip}
                />
              ))
            : null}

          {points.map((point, index) =>
            index % xTickEvery === 0 || index === points.length - 1 ? (
              <text key={`x-${point.key}`} x={scaleX(index)} y={height - 24} className="equity-x-label">
                {point.label}
              </text>
            ) : null
          )}

          {showCurve ? (
            <text x={width - margin.right + 8} y={scaleY(last.cumulative)} className="equity-last-value">
              {money(last.cumulative)}
            </text>
          ) : null}
        </svg>
        {tooltip ? (
          <div
            className="equity-tooltip"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`
            }}
          >
            <strong>{tooltip.label}</strong>
            {showBars ? (
              <span>
                {t(language, "equityTooltipPeriod")}: {money(tooltip.pl)}
              </span>
            ) : null}
            {showCurve ? (
              <span>
                {t(language, "cumulative")}: {money(tooltip.cumulative)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <EquityDisplayControls
        language={language}
        grouping={grouping}
        onGroupingChange={setGrouping}
        showBars={showBars}
        showCurve={showCurve}
        onToggleBars={toggleBars}
        onToggleCurve={toggleCurve}
      />

      <div className="equity-legend">
        {showCurve ? (
          <span>
            <i className="legend-dot line" />
            {t(language, "equityShowCumulativeCurve")}
          </span>
        ) : null}
        {showBars ? (
          <>
            <span>
              <i className="legend-dot win" />
              {t(language, "winners")}
            </span>
            <span>
              <i className="legend-dot loss" />
              {t(language, "losers")}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function EquityToolbar({
  language,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearRange,
  onPresetDays,
  dateMin,
  dateMax
}: {
  language: AppSettings["language"];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onClearRange: () => void;
  onPresetDays: (days: number) => void;
  dateMin: string;
  dateMax: string;
}) {
  const [editingDate, setEditingDate] = useState<"from" | "to" | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const presetLabel = (d: (typeof PRESET_DAYS)[number]) => t(language, `days${d}` as PresetKey);

  const sliderMinDate = dateMin ? parseIsoDateInput(dateMin) : null;
  const sliderMaxDate = dateMax ? parseIsoDateInput(dateMax) : null;
  const sliderTotalDays =
    sliderMinDate && sliderMaxDate ? Math.max(1, daysBetween(sliderMinDate, sliderMaxDate)) : 1;

  const sliderFromDate = parseIsoDateInput(dateFrom || dateMin);
  const sliderToDate = parseIsoDateInput(dateTo || dateMax);
  const sliderFromOffset =
    sliderMinDate && sliderFromDate ? Math.min(sliderTotalDays, Math.max(0, daysBetween(sliderMinDate, sliderFromDate))) : 0;
  const sliderToOffset =
    sliderMinDate && sliderToDate ? Math.min(sliderTotalDays, Math.max(0, daysBetween(sliderMinDate, sliderToDate))) : sliderTotalDays;

  const hasSlider = Boolean(sliderMinDate && sliderMaxDate && daysBetween(sliderMinDate, sliderMaxDate) > 0);

  const beginDateEdit = (target: "from" | "to") => {
    const currentValue = target === "from" ? dateFrom || dateMin : dateTo || dateMax;
    setEditingDate(target);
    setEditingValue(currentValue);
  };

  const commitDateEdit = () => {
    if (!editingDate) return;
    const parsed = parseIsoDateInput(editingValue);
    if (!parsed) {
      setEditingDate(null);
      return;
    }

    let nextDate = parsed;
    if (sliderMinDate && nextDate < sliderMinDate) nextDate = sliderMinDate;
    if (sliderMaxDate && nextDate > sliderMaxDate) nextDate = sliderMaxDate;

    if (editingDate === "from") {
      const currentTo = parseIsoDateInput(dateTo || dateMax);
      if (currentTo && nextDate > currentTo) nextDate = currentTo;
      onDateFromChange(toIsoDateString(nextDate));
    } else {
      const currentFrom = parseIsoDateInput(dateFrom || dateMin);
      if (currentFrom && nextDate < currentFrom) nextDate = currentFrom;
      onDateToChange(toIsoDateString(nextDate));
    }

    setEditingDate(null);
  };

  return (
    <div className="equity-toolbar">
      <div className="equity-toolbar-row equity-range-row">
        <div className="equity-date-inline equity-date-inline-from">
          {editingDate === "from" ? (
            <input
              className="equity-date-chip-input"
              type="date"
              value={editingValue}
              min={dateMin || undefined}
              max={dateTo || dateMax || undefined}
              autoFocus
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={commitDateEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDateEdit();
                }
                if (e.key === "Escape") setEditingDate(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="equity-date-chip"
              title={`${t(language, "equityDateFrom")} (Doppelklick zum Bearbeiten)`}
              onDoubleClick={() => beginDateEdit("from")}
            >
              {dateFrom || dateMin}
            </button>
          )}
        </div>
        {hasSlider ? (
          <div className="equity-range-slider-wrap">
            <div className="equity-range-slider">
              <input
                type="range"
                min={0}
                max={sliderTotalDays}
                step={1}
                value={Math.min(sliderFromOffset, sliderToOffset)}
                onChange={(e) => {
                  if (!sliderMinDate) return;
                  const nextFrom = Number.parseInt(e.target.value, 10);
                  const clamped = Math.min(nextFrom, sliderToOffset);
                  onDateFromChange(toIsoDateString(addDays(sliderMinDate, clamped)));
                }}
                aria-label={t(language, "equityDateFrom")}
              />
              <input
                type="range"
                min={0}
                max={sliderTotalDays}
                step={1}
                value={Math.max(sliderToOffset, sliderFromOffset)}
                onChange={(e) => {
                  if (!sliderMinDate) return;
                  const nextTo = Number.parseInt(e.target.value, 10);
                  const clamped = Math.max(nextTo, sliderFromOffset);
                  onDateToChange(toIsoDateString(addDays(sliderMinDate, clamped)));
                }}
                aria-label={t(language, "equityDateTo")}
              />
            </div>
          </div>
        ) : null}
        <div className="equity-date-inline equity-date-inline-to">
          {editingDate === "to" ? (
            <input
              className="equity-date-chip-input"
              type="date"
              value={editingValue}
              min={dateFrom || dateMin || undefined}
              max={dateMax || undefined}
              autoFocus
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={commitDateEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDateEdit();
                }
                if (e.key === "Escape") setEditingDate(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="equity-date-chip"
              title={`${t(language, "equityDateTo")} (Doppelklick zum Bearbeiten)`}
              onDoubleClick={() => beginDateEdit("to")}
            >
              {dateTo || dateMax}
            </button>
          )}
        </div>
      </div>
      <div className="equity-toolbar-row equity-preset-row">
        <div className="equity-controls equity-presets">
          {PRESET_DAYS.map((d) => (
            <button key={d} type="button" onClick={() => onPresetDays(d)}>
              {presetLabel(d)}
            </button>
          ))}
          <button type="button" className={!dateFrom && !dateTo ? "active" : ""} onClick={onClearRange}>
            {t(language, "equityClearRange")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EquityDisplayControls({
  language,
  showBars,
  showCurve,
  onToggleBars,
  onToggleCurve,
  grouping,
  onGroupingChange
}: {
  language: AppSettings["language"];
  showBars: boolean;
  showCurve: boolean;
  onToggleBars: (v: boolean) => void;
  onToggleCurve: (v: boolean) => void;
  grouping: Grouping;
  onGroupingChange: (g: Grouping) => void;
}) {
  const groupingLabel: Record<Grouping, string> = {
    day: t(language, "equityGroupingDay"),
    week: t(language, "equityGroupingWeek"),
    month: t(language, "equityGroupingMonth"),
    year: t(language, "equityGroupingYear")
  };

  return (
    <div className="equity-toolbar-row equity-display-row">
      <div className="equity-controls equity-grouping-inline">
        {(["day", "week", "month", "year"] as Grouping[]).map((value) => (
          <button
            key={value}
            type="button"
            className={grouping === value ? "active" : ""}
            onClick={() => onGroupingChange(value)}
          >
            {groupingLabel[value]}
          </button>
        ))}
      </div>
      <label className="equity-check">
        <input type="checkbox" checked={showBars} onChange={(e) => onToggleBars(e.target.checked)} />
        <span>{t(language, "equityShowBalanceBars")}</span>
      </label>
      <label className="equity-check">
        <input type="checkbox" checked={showCurve} onChange={(e) => onToggleCurve(e.target.checked)} />
        <span>{t(language, "equityShowCumulativeCurve")}</span>
      </label>
    </div>
  );
}
