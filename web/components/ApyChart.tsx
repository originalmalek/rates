"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { RateSnapshot } from "@/lib/types";
import { buildChartData } from "@/lib/chartData";

interface Props {
  snapshots: RateSnapshot[];
}

function formatXAxisTick(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTooltipLabel(label: unknown): string {
  const epochMs = Number(label);
  if (isNaN(epochMs)) return String(label ?? "");
  const d = new Date(epochMs);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export default function ApyChart({ snapshots }: Props) {
  const { series, points } = buildChartData(snapshots);

  if (points.length === 0) {
    return (
      <p className="text-center text-zinc-600 py-8 text-sm">
        No history data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart
        data={points}
        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#26262c" />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatXAxisTick}
          tick={{ fontSize: 11, fill: "#8a8a93" }}
          tickLine={false}
          axisLine={{ stroke: "#26262c" }}
          minTickGap={60}
        />
        <YAxis
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          tick={{ fontSize: 11, fill: "#8a8a93" }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          labelFormatter={formatTooltipLabel}
          formatter={(value, name) => [formatTooltipValue(value), name]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #26262c",
            background: "#131316",
            color: "#e7e7ea",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.4)",
          }}
          labelStyle={{ color: "#a1a1aa" }}
          itemStyle={{ color: "#e7e7ea" }}
          cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#a1a1aa" }}
          iconType="line"
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
