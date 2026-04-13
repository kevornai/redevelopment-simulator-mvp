'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { year: '현재', best: 0, base: 0, worst: 0 },
  { year: '1년 차', best: 3000, base: 1000, worst: -2000 },
  { year: '2년 차', best: 7000, base: 2000, worst: -4000 },
  { year: '3년 차', best: 13000, base: 3000, worst: -7000 },
  { year: '4년 차', best: 19000, base: 4000, worst: -10000 },
  { year: '5년 차', best: 25000, base: 5000, worst: -12000 },
];

function formatWon(value: number) {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}억`;
  return `${sign}${(abs / 1000).toFixed(0)}천만`;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const nameMap: Record<string, string> = {
    best: '최상 시나리오 (수익금)',
    base: '기준 시나리오 (수익금)',
    worst: '최악 시나리오 (예상 마진)',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-zinc-500 text-xs">{nameMap[item.name] ?? item.name}:</span>
          <span
            className={`font-bold text-xs ${
              item.value > 0 ? 'text-teal-600' : item.value < 0 ? 'text-red-500' : 'text-zinc-600'
            }`}
          >
            {formatWon(item.value)}원
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProfitScenarioChart() {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatWon}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => {
              const map: Record<string, string> = {
                best: '최상 (Best)',
                base: '기준 (Base)',
                worst: '최악 (Worst)',
              };
              return <span className="text-xs text-zinc-500">{map[value] ?? value}</span>;
            }}
          />

          {/* Best — teal area + line */}
          <Area
            type="monotone"
            dataKey="best"
            fill="#ccfbf1"
            fillOpacity={0.5}
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="best"
            stroke="#0d9488"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {/* Base — slate line */}
          <Line
            type="monotone"
            dataKey="base"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
          />

          {/* Worst — red area + line */}
          <Area
            type="monotone"
            dataKey="worst"
            fill="#fee2e2"
            fillOpacity={0.5}
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="worst"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
