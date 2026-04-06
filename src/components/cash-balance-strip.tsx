type CashBalancePoint = {
  label: string;
  value: number;
  inflowRub: number;
  outflowRub: number;
};

type CashBalanceStripProps = {
  title: string;
  subtitle?: string;
  points: CashBalancePoint[];
  valueFormatter: (value: number) => string;
};

export function CashBalanceStrip({ title, subtitle, points, valueFormatter }: CashBalanceStripProps) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <section className="product-frame">
      <div className="product-frame__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="cash-balance-strip">
        {points.map((point) => {
          const normalized = range > 0 ? (point.value - min) / range : 1;
          const height = 26 + normalized * 74;
          const tone = point.value < 0 ? "danger" : point.value === min ? "warning" : "success";

          return (
            <article className="cash-balance-strip__item" key={`${point.label}:${point.value}`}>
              <div className="cash-balance-strip__value">{valueFormatter(point.value)}</div>
              <div className="cash-balance-strip__track">
                <div className={`cash-balance-strip__bar cash-balance-strip__bar--${tone}`} style={{ height: `${height}%` }} />
              </div>
              <div className="cash-balance-strip__meta">
                <strong>{point.label}</strong>
                <span>+{valueFormatter(point.inflowRub)}</span>
                <span>-{valueFormatter(point.outflowRub)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
