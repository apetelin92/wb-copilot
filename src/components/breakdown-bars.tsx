type BreakdownBarItem = {
  label: string;
  value: number;
  suffix?: string;
};

export function BreakdownBars({ title, subtitle, items }: { title: string; subtitle?: string; items: BreakdownBarItem[] }) {
  if (items.length === 0) {
    return null;
  }

  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  return (
    <section className="product-frame">
      <div className="product-frame__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="product-breakdown">
        {items.map((item, index) => (
          <div className="product-breakdown__row" key={item.label}>
            <div className="product-breakdown__meta">
              <strong>{item.label}</strong>
              <span>
                {item.value.toLocaleString("ru-RU")} {item.suffix ?? "₽"}
              </span>
            </div>
            <div className="product-breakdown__rail">
              <div className={`product-breakdown__fill ${index < 2 ? "product-breakdown__fill--primary" : ""}`} style={{ width: `${Math.max((Math.abs(item.value) / max) * 100, 4)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
