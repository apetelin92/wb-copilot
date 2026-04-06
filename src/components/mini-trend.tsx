type Point = {
  label: string;
  value: number;
};

export function MiniTrend({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return <div className="mini-trend mini-trend--empty">Нет данных</div>;
  }

  const width = 240;
  const height = 72;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mini-trend">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <div className="mini-trend__labels">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
