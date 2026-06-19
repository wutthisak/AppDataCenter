"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { InspectionShiftKey } from "@/lib/inspection-shifts";

type ShiftStatusRow = {
  shift: InspectionShiftKey;
  label: string;
  inspections: number;
  normal: number;
  abnormal: number;
};

export function ShiftStatusChart({ data, height = 300 }: { data: ShiftStatusRow[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              inspections: "จำนวนครั้ง",
              normal: "ปกติ",
              abnormal: "ผิดปกติ"
            };
            return [value, labels[String(name)] ?? name];
          }}
        />
        <Legend />
        <Bar dataKey="normal" name="ปกติ" stackId="status" fill="#14b8a6" radius={[0, 0, 4, 4]} />
        <Bar dataKey="abnormal" name="ผิดปกติ" stackId="status" fill="#ef4444" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type TrendSeries = {
  key: InspectionShiftKey;
  name: string;
  color: string;
};

type TrendRow = { date: string } & Partial<Record<InspectionShiftKey, number>>;

export function ShiftTemperatureTrendChart({
  data,
  series,
  height = 320
}: {
  data: TrendRow[];
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" />
        <YAxis label={{ value: "อุณหภูมิเฉลี่ย (°C)", angle: -90, position: "insideLeft" }} />
        <Tooltip formatter={(value, name) => [`${value} °C`, name]} />
        <Legend />
        {series.map((item) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.name}
            stroke={item.color}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
