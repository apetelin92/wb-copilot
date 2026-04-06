import { formatShortNumber } from "@/lib/format";

type CashTrajectoryPoint = {
  label: string;
  value: number;
};

type CashTrajectoryChartProps = {
  title: string;
  badgeLabel?: string;
  points: CashTrajectoryPoint[];
  valueFormatter: (value: number) => string;
  compactValueFormatter?: (value: number) => string;
  subtitle?: string;
};

export function CashTrajectoryChart({ title, badgeLabel, points, valueFormatter, compactValueFormatter, subtitle }: CashTrajectoryChartProps) {
  if (points.length === 0) {
    return null;
  }

  const width = Math.max(720, points.length * 98);
  const height = 320;
  const paddingX = 32;
  const paddingTop = 26;
  const paddingBottom = 52;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerHeight = height - paddingTop - paddingBottom;
  const innerWidth = width - paddingX * 2;
  const compactFormatter =
    compactValueFormatter ??
    ((value: number) => {
      const prefix = formatShortNumber(Math.abs(value));
      return `${value < 0 ? "−" : ""}${prefix} ₽`;
    });

  const coordinates = points.map((point, index) => {
    const x = paddingX + (index / Math.max(points.length - 1, 1)) * innerWidth;
    const y = paddingTop + (1 - (point.value - min) / range) * innerHeight;

    return { ...point, x, y };
  });

  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x} ${height - paddingBottom} L ${coordinates[0]?.x} ${height - paddingBottom} Z`;
  const tickValues = [...new Set([max, min + range * 0.5, min].map((value) => Math.round(value)))];
  const minIndex = values.indexOf(min);
  const maxIndex = values.indexOf(max);
  const lastIndex = points.length - 1;
  const labeledIndexes = new Set([minIndex, maxIndex, lastIndex]);
  const xLabelStep = points.length > 16 ? 3 : points.length > 10 ? 2 : 1;
  const zeroLineY = min <= 0 && max >= 0 ? paddingTop + (1 - (0 - min) / range) * innerHeight : null;
  const minPoint = coordinates[minIndex];

  return (
    <section className="product-frame">
      <div className="product-frame__header">
        <div>
          <div className="meta-row">
            <h3>{title}</h3>
            {badgeLabel ? <span className="product-frame__badge">{badgeLabel}</span> : null}
          </div>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      <div className="cash-trajectory-chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="cash-area-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5b5df0" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#5b5df0" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {tickValues.map((tick) => {
            const y = paddingTop + (1 - (tick - min) / range) * innerHeight;

            return (
              <g key={tick}>
                <line className="cash-trajectory-chart__grid" x1={paddingX} x2={width - paddingX} y1={y} y2={y} />
                <text className="cash-trajectory-chart__axis-label" x={paddingX} y={Math.max(y - 8, 12)}>
                  {compactFormatter(tick)}
                </text>
              </g>
            );
          })}

          {zeroLineY !== null ? <line className="cash-trajectory-chart__zero" x1={paddingX} x2={width - paddingX} y1={zeroLineY} y2={zeroLineY} /> : null}

          {minPoint ? <line className="cash-trajectory-chart__focus" x1={minPoint.x} x2={minPoint.x} y1={paddingTop} y2={height - paddingBottom} /> : null}

          <path className="cash-trajectory-chart__area" d={areaPath} />
          <path className="cash-trajectory-chart__line" d={linePath} />

          {coordinates.map((point, index) => (
            <g key={`${point.label}:${point.value}`}>
              <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
              <circle className={`cash-trajectory-chart__dot${labeledIndexes.has(index) ? " cash-trajectory-chart__dot--highlight" : ""}`} cx={point.x} cy={point.y} r={labeledIndexes.has(index) ? "5.5" : "4.5"} />
              {labeledIndexes.has(index) ? (
                <text
                  className="cash-trajectory-chart__value"
                  textAnchor={index === 0 ? "start" : index === lastIndex ? "end" : "middle"}
                  x={point.x}
                  y={point.y - 12}
                >
                  {index === minIndex ? `Мин: ${compactFormatter(point.value)}` : compactFormatter(point.value)}
                </text>
              ) : null}
              {index % xLabelStep === 0 || index === lastIndex ? (
                <text className="cash-trajectory-chart__x-label" x={point.x} y={height - 18}>
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
