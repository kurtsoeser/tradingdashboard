import { money } from "../lib/analytics";

interface BarDatum {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: BarDatum[];
  mode?: "pl" | "count";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SimpleBarChart({ data, mode = "pl" }: SimpleBarChartProps) {
  const width = 1000;
  const height = 360;
  const margin = { top: 18, right: 14, bottom: 48, left: 78 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (data.length === 0) {
    return <div className="chart-empty">Keine Daten vorhanden.</div>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const rawSpan = Math.max(maxValue - minValue, 1);
  const pad = rawSpan * 0.08;
  const domainMin = mode === "count" ? 0 : minValue - pad;
  const domainMax = maxValue + pad;
  const safeMin = domainMin === domainMax ? domainMin - 1 : domainMin;
  const safeMax = domainMin === domainMax ? domainMax + 1 : domainMax;
  const range = safeMax - safeMin;
  const hasNegative = safeMin < 0;
  const zeroY = hasNegative ? margin.top + ((safeMax - 0) / range) * innerH : margin.top + innerH;

  const scaleY = (value: number) => margin.top + ((safeMax - value) / range) * innerH;
  const step = innerW / data.length;
  const barWidth = clamp(step * 0.64, 18, 44);
  const xTickEvery = Math.ceil(data.length / 14);

  const ticks = Array.from({ length: 5 }, (_, idx) => {
    const ratio = idx / 4;
    const value = safeMax - ratio * range;
    return {
      value,
      y: margin.top + ratio * innerH
    };
  });

  const formatTick = (value: number) => {
    if (mode === "count") return `${Math.round(value)}`;
    return money(value);
  };

  return (
    <div className="bar-chart-wrap" role="img" aria-label="Balkendiagramm">
      <svg className="bar-chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick, index) => (
          <g key={`tick-${index}`}>
            <line className="bar-chart-grid-line" x1={margin.left} y1={tick.y} x2={width - margin.right} y2={tick.y} />
            <text className="bar-chart-y-label" x={margin.left - 10} y={tick.y + 4}>
              {formatTick(tick.value)}
            </text>
          </g>
        ))}

        <line className="bar-chart-axis-line" x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} />
        <line className="bar-chart-axis-line" x1={margin.left} y1={zeroY} x2={width - margin.right} y2={zeroY} />

        {data.map((d, index) => {
          const x = margin.left + index * step + (step - barWidth) / 2;
          const yTop = scaleY(d.value);
          const y = d.value >= 0 ? yTop : zeroY;
          const h = Math.max(2, Math.abs(zeroY - yTop));
          return (
            <g key={`bar-${d.label}-${index}`}>
              <rect className={d.value >= 0 ? "bar-chart-bar win" : "bar-chart-bar loss"} x={x} y={y} width={barWidth} height={h} rx={4} />
              {index % xTickEvery === 0 || index === data.length - 1 ? (
                <text className="bar-chart-x-label" x={x + barWidth / 2} y={height - 20}>
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
