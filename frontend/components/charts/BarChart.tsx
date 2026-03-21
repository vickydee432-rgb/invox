"use client";

import { useMemo } from "react";

type Row = { label: string; a: number; b: number };

export default function BarChart({
  rows,
  height = 220,
  colorA = "#16a34a",
  colorB = "#ef4444"
}: {
  rows: Row[];
  height?: number;
  colorA?: string;
  colorB?: string;
}) {
  const bars = useMemo(() => {
    const width = 700;
    const padX = 24;
    const padY = 20;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const maxVal = Math.max(
      1,
      ...rows.flatMap((r) => [Number(r.a || 0), Number(r.b || 0)])
    );
    const groupW = rows.length ? innerW / rows.length : innerW;
    const barW = Math.max(6, groupW * 0.32);

    return rows.map((r, idx) => {
      const x0 = padX + idx * groupW + groupW * 0.18;
      const ha = (Number(r.a || 0) / maxVal) * innerH;
      const hb = (Number(r.b || 0) / maxVal) * innerH;
      return {
        label: r.label,
        ax: x0,
        ay: padY + (innerH - ha),
        ah: ha,
        bx: x0 + barW + groupW * 0.1,
        by: padY + (innerH - hb),
        bh: hb,
        w: barW
      };
    });
  }, [rows, height]);

  return (
    <div className="chart">
      <svg viewBox={`0 0 700 ${height}`} width="100%" height={height} role="img" aria-label="Bar chart">
        <rect x="0" y="0" width="700" height={height} fill="transparent" />
        {bars.map((b) => (
          <g key={b.label}>
            <rect x={b.ax} y={b.ay} width={b.w} height={b.ah} fill={colorA} opacity="0.9" rx="3" />
            <rect x={b.bx} y={b.by} width={b.w} height={b.bh} fill={colorB} opacity="0.85" rx="3" />
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: colorA }} /> Revenue
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: colorB }} /> Expenses
        </span>
      </div>
    </div>
  );
}

