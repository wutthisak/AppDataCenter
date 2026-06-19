"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TemperatureChartProps {
  data: any[];
  temperatureItems: { id: string; name: string }[];
}

export function TemperatureChart({ data, temperatureItems }: TemperatureChartProps) {
  return (
    <div style={{ height: 400, marginTop: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: 'อุณหภูมิ (°C)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          {temperatureItems.map((item) => (
            <Line
              key={item.id}
              type="monotone"
              dataKey={item.name}
              stroke={`hsl(${Math.random() * 360}, 70%, 50%)`}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
