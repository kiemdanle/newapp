/**
 * Minimal dependency-free bar chart rendered as inline SVG. Used by analytics
 * pages for daily time series. Server-rendered.
 */
export function BarChart({
  data,
  height = 200,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No data for this range.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / data.length;
  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 20);
          return (
            <g key={i}>
              <rect
                x={i * barW + barW * 0.15}
                y={height - h - 16}
                width={barW * 0.7}
                height={h}
                fill="hsl(var(--primary))"
                rx={0.5}
              >
                <title>
                  {d.label}: {d.value}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
