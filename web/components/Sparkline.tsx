"use client";

import { useMemo } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

/**
 * Tiny inline SVG line chart for table rows. No axes, no dots, no
 * tooltip — just the shape of the last 24h. Self-scaling on both
 * axes; flat series render as a horizontal mid-line.
 */
export default function Sparkline({
  data,
  width = 80,
  height = 22,
  stroke,
}: Props) {
  const path = useMemo(() => buildPath(data, width, height), [data, width, height]);
  const trend = useMemo(() => deriveTrend(data), [data]);
  const color = stroke ?? trendColor(trend);

  if (data.length < 2) {
    return (
      <span
        aria-hidden
        className="inline-block"
        style={{ width, height }}
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="inline-block align-middle"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function buildPath(data: number[], w: number, h: number): string {
  if (data.length < 2) return "";
  const pad = 2;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  let min = data[0];
  let max = data[0];
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const x = (i: number) => pad + (innerW * i) / (data.length - 1);
  const y = (v: number) => {
    if (span === 0) return pad + innerH / 2;
    return pad + innerH - ((v - min) / span) * innerH;
  };
  let d = `M ${x(0).toFixed(2)} ${y(data[0]).toFixed(2)}`;
  for (let i = 1; i < data.length; i++) {
    d += ` L ${x(i).toFixed(2)} ${y(data[i]).toFixed(2)}`;
  }
  return d;
}

function deriveTrend(data: number[]): "up" | "down" | "flat" {
  if (data.length < 2) return "flat";
  const diff = data[data.length - 1] - data[0];
  if (Math.abs(diff) < 0.01) return "flat";
  return diff > 0 ? "up" : "down";
}

function trendColor(trend: "up" | "down" | "flat"): string {
  if (trend === "up") return "#34d399"; // emerald-400
  if (trend === "down") return "#fb7185"; // rose-400
  return "#71717a"; // zinc-500
}
