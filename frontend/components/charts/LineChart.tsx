"use client";

import { useMemo } from "react";

type Point = { label: string; value: number };

export default function LineChart({
  points,
  height = 200,
  stroke = "#2563eb"
}: {
  points: Point[];
  height?: number;
  stroke?: string;
}) {
  const { path, min, max } = useMemo(() => {
    const values = points.map((p) => Number(p.value || 0));
    const minVal = values.length ? Math.min(...values) : 0;
    const maxVal = values.length ? Math.max(...values) : 0;
    const span = maxVal - minVal || 1;

    const width = 600;
    const padX = 24;
    const padY = 18;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const xy = points.map((p, idx) => {
      const x = padX + (points.length <= 1 ? innerW / 2 : (idx / (points.length - 1)) * innerW);
      const norm = (Number(p.value || 0) - minVal) / span;
      const y = padY + (1 - norm) * innerH;
      return { x, y };
    });
    const d = xy
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(" ");
    return { path: d, min: minVal, max: maxVal };
  }, [points, height]);

  return (
    <div className="chart">
      <svg viewBox={`0 0 600 ${height}`} width="100%" height={height} role="img" aria-label="Line chart">
        <rect x="0" y="0" width="600" height={height} fill="transparent" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <text x="24" y="14" fontSize="10" fill="#6b7280">
          {max.toFixed(2)}
        </text>
        <text x="24" y={height - 4} fontSize="10" fill="#6b7280">
          {min.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

