type BarStripPoint = {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warning" | "success";
};

export function BarStripChart({ title, subtitle, points }: { title: string; subtitle?: string; points: BarStripPoint[] }) {
  if (points.length === 0) {
    return null;
  }

  const maxAbs = Math.max(...points.map((point) => Math.abs(point.value)), 1);

  return (
    <section className="product-frame">
      <div className="product-frame__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="bar-strip-chart">
        {points.map((point) => {
          const height = Math.max((Math.abs(point.value) / maxAbs) * 100, 14);
          const tone = point.tone ?? (point.value < 0 ? "danger" : "default");

          return (
            <div className="bar-strip-chart__item" key={`${point.label}:${point.value}`}>
              <div className="bar-strip-chart__track">
                <div className={`bar-strip-chart__bar bar-strip-chart__bar--${tone}`} style={{ height: `${height}%` }} />
              </div>
              <strong>{point.label}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
