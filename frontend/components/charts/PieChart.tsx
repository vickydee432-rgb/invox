"use client";

import { useMemo } from "react";

type Slice = { label: string; value: number; color?: string };

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

const DEFAULT_COLORS = ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#ef4444", "#06b6d4", "#84cc16"];

export default function PieChart({
  slices,
  size = 220
}: {
  slices: Slice[];
  size?: number;
}) {
  const { paths, total } = useMemo(() => {
    const filtered = slices.filter((s) => Number(s.value || 0) > 0);
    const sum = filtered.reduce((acc, s) => acc + Number(s.value || 0), 0) || 1;
    let angle = 0;
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.floor(size * 0.42);
    const p = filtered.map((s, idx) => {
      const start = angle;
      const delta = (Number(s.value || 0) / sum) * 360;
      const end = start + delta;
      angle = end;
      return {
        label: s.label,
        value: Number(s.value || 0),
        color: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        d: arcPath(cx, cy, r, start, end)
      };
    });
    return { paths: p, total: sum };
  }, [slices, size]);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} role="img" aria-label="Pie chart">
        <rect x="0" y="0" width={size} height={size} fill="transparent" />
        {paths.map((p) => (
          <path key={p.label} d={p.d} fill={p.color} opacity="0.9" stroke="#ffffff" strokeWidth="1" />
        ))}
      </svg>
      <div className="chart-legend">
        {paths.slice(0, 8).map((p) => (
          <span key={p.label} className="legend-item">
            <span className="legend-swatch" style={{ background: p.color }} /> {p.label}{" "}
            <span className="muted">({Math.round((p.value / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

