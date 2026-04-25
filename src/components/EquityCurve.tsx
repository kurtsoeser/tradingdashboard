import { useMemo, useState, type MouseEvent } from "react";
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

export function EquityCurve({ trades }: { trades: Trade[] }) {
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [tooltip, setTooltip] = useState<EquityTooltip | null>(null);
  const points = useMemo(() => buildPoints(trades, grouping), [trades, grouping]);

  if (points.length === 0) {
    return (
      <div className="equity-empty">
        Keine geschlossenen Trades fuer die Equity-Kurve vorhanden.
      </div>
    );
  }

  const width = 1120;
  const height = 420;
  const margin = { top: 30, right: 70, bottom: 58, left: 84 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const allValues = points.flatMap((point) => [point.pl, point.cumulative, 0]);
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yStep = 1000;
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
  const yTicks = [];
  for (let value = safeDomainMax; value >= safeDomainMin; value -= yStep) {
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
          <h3>Equity-Kurve</h3>
          <p>Fahre mit der Maus ueber die Balken fuer Details</p>
        </div>
        <div className="equity-controls">
          {(["day", "week", "month", "year"] as Grouping[]).map((value) => (
            <button
              key={value}
              className={grouping === value ? "active" : ""}
              onClick={() => setGrouping(value)}
            >
              {value === "day" ? "Tag" : value === "week" ? "Woche" : value === "month" ? "Monat" : "Jahr"}
            </button>
          ))}
        </div>
      </div>

      <div className="equity-chart-wrap">
        <svg
          className="equity-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Equity-Kurve"
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

        {points.map((point, index) => {
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
        })}

        <path d={linePath} className="equity-line-area" />
        <path d={linePath} className="equity-line" />

        {points.map((point, index) => (
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
        ))}

        {points.map((point, index) =>
          index % xTickEvery === 0 || index === points.length - 1 ? (
            <text key={`x-${point.key}`} x={scaleX(index)} y={height - 24} className="equity-x-label">
              {point.label}
            </text>
          ) : null
        )}

        <text x={width - margin.right + 8} y={scaleY(last.cumulative)} className="equity-last-value">
          {money(last.cumulative)}
        </text>
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
            <span>Periode: {money(tooltip.pl)}</span>
            <span>Kumulativ: {money(tooltip.cumulative)}</span>
          </div>
        ) : null}
      </div>

      <div className="equity-legend">
        <span><i className="legend-dot line" />Kumulativer P&amp;L</span>
        <span><i className="legend-dot win" />Gewinn</span>
        <span><i className="legend-dot loss" />Verlust</span>
      </div>
    </div>
  );
}
