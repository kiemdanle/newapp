'use client';

import * as React from 'react';
import type { BarcodeTimelineBucket } from '@expyrico/shared';
import { BarChart3 } from 'lucide-react';

interface VolumeChartProps {
  timeline: BarcodeTimelineBucket[];
  range: '24h' | '7d' | '30d';
}

export function VolumeTimelineChart({ timeline, range }: VolumeChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  if (timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-[#FAFAF8] p-6 text-center shadow-xs">
        <BarChart3 className="mx-auto h-8 w-8 text-[#8C8C85] opacity-50 mb-2" />
        <p className="text-sm font-medium text-[#8C8C85]">
          No call volume recorded for this time range.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(1, ...timeline.map((b) => b.total));
  const height = 180;
  const barWidth = 100 / timeline.length;

  const formatBucketTime = (iso: string) => {
    const d = new Date(iso);
    if (range === '24h') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const hoveredBucket = hoveredIndex !== null ? timeline[hoveredIndex] : null;

  return (
    <div className="rounded-2xl border border-border bg-[#FAFAF8] p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#2C2C28] font-display flex items-center gap-2">
            <BarChart3 size={16} className="text-[#3A8F6F]" />
            Call Volume & Outcome Timeline ({range})
          </h3>
          <p className="text-xs text-[#8C8C85] mt-0.5">
            {range === '24h' ? 'Hourly' : 'Daily'} request volume across external providers
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#4BAE8A]" />
            <span className="text-[#2C2C28] font-medium">Hits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#8C8C85]" />
            <span className="text-[#2C2C28] font-medium">Misses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#F5A623]" />
            <span className="text-[#2C2C28] font-medium">Rate Limits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#E0442A]" />
            <span className="text-[#2C2C28] font-medium">Errors/Timeouts</span>
          </div>
        </div>
      </div>

      {/* Hover preview tooltip */}
      <div className="min-h-[28px] mb-2 text-xs">
        {hoveredBucket ? (
          <div className="flex flex-wrap items-center gap-3 py-1 px-2.5 rounded-lg bg-white border border-border text-[#2C2C28] shadow-2xs font-mono">
            <span className="font-bold text-[#3A8F6F]">
              {formatBucketTime(hoveredBucket.timestamp)}
            </span>
            <span>Total: <strong>{hoveredBucket.total}</strong></span>
            <span className="text-[#3A8F6F]">Hits: {hoveredBucket.hits}</span>
            <span className="text-[#8C8C85]">Misses: {hoveredBucket.misses}</span>
            {hoveredBucket.rateLimited > 0 && (
              <span className="text-[#F5A623] font-bold">
                Rate Limited: {hoveredBucket.rateLimited}
              </span>
            )}
            {hoveredBucket.errors + hoveredBucket.timeouts > 0 && (
              <span className="text-[#E0442A] font-bold">
                Errors: {hoveredBucket.errors + hoveredBucket.timeouts}
              </span>
            )}
            <span className="text-[#8C8C85] ml-auto font-sans">
              Providers: {Object.entries(hoveredBucket.byProvider).map(([k, v]) => `${k}:${v}`).join(', ')}
            </span>
          </div>
        ) : (
          <span className="text-[#8C8C85] italic text-[11px]">
            Hover over any bar to inspect status breakdown and provider distribution
          </span>
        )}
      </div>

      {/* Inline SVG Chart */}
      <div className="w-full">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full overflow-visible"
          style={{ height }}
          role="img"
          aria-label="Call volume timeline"
        >
          {/* Background gridlines */}
          <line x1="0" y1={height * 0.25} x2="100" y2={height * 0.25} stroke="#F0F0ED" strokeDasharray="1 1" />
          <line x1="0" y1={height * 0.50} x2="100" y2={height * 0.50} stroke="#F0F0ED" strokeDasharray="1 1" />
          <line x1="0" y1={height * 0.75} x2="100" y2={height * 0.75} stroke="#F0F0ED" strokeDasharray="1 1" />

          {timeline.map((bucket, i) => {
            const totalH = (bucket.total / maxTotal) * (height - 30);
            const hitsH = (bucket.hits / maxTotal) * (height - 30);
            const missesH = (bucket.misses / maxTotal) * (height - 30);
            const rateH = (bucket.rateLimited / maxTotal) * (height - 30);
            const errH = ((bucket.errors + bucket.timeouts) / maxTotal) * (height - 30);

            const x = i * barWidth + barWidth * 0.15;
            const w = barWidth * 0.7;
            const base = height - 15;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer transition-opacity hover:opacity-80"
              >
                {/* Hit segment */}
                {hitsH > 0 && (
                  <rect
                    x={x}
                    y={base - hitsH}
                    width={w}
                    height={hitsH}
                    fill="#4BAE8A"
                    rx={0.5}
                  />
                )}
                {/* Miss segment */}
                {missesH > 0 && (
                  <rect
                    x={x}
                    y={base - hitsH - missesH}
                    width={w}
                    height={missesH}
                    fill="#8C8C85"
                  />
                )}
                {/* Rate limited segment */}
                {rateH > 0 && (
                  <rect
                    x={x}
                    y={base - hitsH - missesH - rateH}
                    width={w}
                    height={rateH}
                    fill="#F5A623"
                  />
                )}
                {/* Error segment */}
                {errH > 0 && (
                  <rect
                    x={x}
                    y={base - hitsH - missesH - rateH - errH}
                    width={w}
                    height={errH}
                    fill="#E0442A"
                  />
                )}
                {/* Transparent hit target */}
                <rect
                  x={x}
                  y={0}
                  width={w}
                  height={height}
                  fill="transparent"
                />
              </g>
            );
          })}
        </svg>

        {/* X Axis labels */}
        <div className="flex justify-between text-[11px] font-mono text-[#8C8C85] mt-2 pt-1 border-t border-border/60">
          <span>{formatBucketTime(timeline[0]!.timestamp)}</span>
          {timeline.length > 2 && (
            <span>{formatBucketTime(timeline[Math.floor(timeline.length / 2)]!.timestamp)}</span>
          )}
          <span>{formatBucketTime(timeline[timeline.length - 1]!.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
