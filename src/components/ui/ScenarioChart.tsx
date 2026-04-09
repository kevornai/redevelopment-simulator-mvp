'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { stage: '현재 매수', best: 0,     base: 0,    worst: 0 },
  { stage: '관리처분',  best: 8000,  base: 1500, worst: -1500 },
  { stage: '착공',      best: 16000, base: 2800, worst: -4000 },
  { stage: '입주 (5년 뒤)', best: 25000, base: 4000, worst: -15000 },
];

const Y_MAX = 27000;
const Y_MIN = -17000;
const Y_RANGE = Y_MAX - Y_MIN;     // 44000
const CHART_HEIGHT = 280;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const MARGIN_RIGHT = 100;
const PLOT_H = CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM; // 240

// Pixel positions for the vertical risk arrow
const bestPx  = MARGIN_TOP + ((Y_MAX - 25000) / Y_RANGE) * PLOT_H;  // ≈ 31
const worstPx = MARGIN_TOP + ((Y_MAX - (-15000)) / Y_RANGE) * PLOT_H; // ≈ 257
const ARROW_TOP    = bestPx;
const ARROW_HEIGHT = worstPx - bestPx;

function formatWon(v: number) {
  if (v === 0) return '0';
  const abs  = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}억`;
  return `${sign}${(abs / 1000).toFixed(0)}천만`;
}

interface TooltipItem { name: string; value: number; color: string }
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const nameMap: Record<string, string> = {
    best: '최상 시나리오',
    base: '기준 시나리오',
    worst: '최악 시나리오',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-700 mb-1.5">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-zinc-500">{nameMap[item.name] ?? item.name}:</span>
          <span className={`font-bold ${item.value > 0 ? 'text-blue-600' : item.value < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
            {formatWon(item.value)}원
          </span>
        </div>
      ))}
    </div>
  );
}

interface LabelProps { viewBox?: { x: number; y: number; width: number; height: number } }
function DangerLabel({ viewBox }: LabelProps) {
  if (!viewBox) return null;
  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height / 2;
  return (
    <g>
      <text x={cx} y={cy - 7} textAnchor="middle" fill="#ef4444" fontSize={9} fontWeight={600} opacity={0.65}>
        분담금 폭탄으로 인한
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#ef4444" fontSize={9} fontWeight={600} opacity={0.65}>
        원금 손실 구간
      </text>
    </g>
  );
}

export default function ScenarioChart() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-4 h-full flex flex-col">
      <p className="text-xs text-zinc-400 text-center mb-1">사업 단계별 예상 순수익 시나리오 (만원 기준)</p>

      {/* Legend */}
      <div className="flex justify-center gap-4 mb-2">
        {[
          { label: '최상 (Best)',  color: '#3b82f6', dash: false },
          { label: '기준 (Base)',  color: '#4b5563', dash: true  },
          { label: '최악 (Worst)', color: '#ef4444', dash: false },
        ].map(({ label, color, dash }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-zinc-500">
            <svg width="20" height="10">
              <line
                x1="0" y1="5" x2="20" y2="5"
                stroke={color}
                strokeWidth="2"
                strokeDasharray={dash ? '4 2' : undefined}
              />
            </svg>
            {label}
          </div>
        ))}
      </div>

      {/* Chart + Arrow overlay */}
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart
            data={data}
            margin={{ top: MARGIN_TOP, right: MARGIN_RIGHT, bottom: MARGIN_BOTTOM, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

            <XAxis
              dataKey="stage"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[Y_MIN, Y_MAX]}
              tickFormatter={formatWon}
              tick={{ fill: '#94a3b8', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Danger zone */}
            <ReferenceArea
              y1={Y_MIN}
              y2={0}
              fill="#fef2f2"
              fillOpacity={0.8}
              label={<DangerLabel />}
            />

            {/* Breakeven */}
            <ReferenceLine
              y={0}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{ value: '손익 0', position: 'insideLeft', fill: '#9ca3af', fontSize: 9 }}
            />

            <Line type="monotone" dataKey="best"  stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6'  }} activeDot={{ r: 5 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="base"  stroke="#4b5563" strokeWidth={2}   strokeDasharray="5 3" dot={{ r: 3, fill: '#4b5563'  }} activeDot={{ r: 5 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>

        {/* ── Volatility band arrow overlay ── */}
        <div
          className="absolute pointer-events-none"
          style={{ right: 8, top: ARROW_TOP, height: ARROW_HEIGHT, width: 88 }}
        >
          {/* Text label */}
          <div
            className="absolute text-right leading-tight"
            style={{ right: 14, top: '50%', transform: 'translateY(-50%)', width: 68 }}
          >
            <p className="text-zinc-500 font-bold" style={{ fontSize: 9 }}>최대</p>
            <p className="text-zinc-800 font-extrabold" style={{ fontSize: 11 }}>4억 원</p>
            <p className="text-zinc-500 font-semibold" style={{ fontSize: 9 }}>변동 리스크</p>
          </div>

          {/* Vertical double-headed arrow */}
          <div className="absolute" style={{ right: 0, top: 0, bottom: 0, width: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Top arrowhead */}
            <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #6b7280' }} />
            {/* Line */}
            <div style={{ flex: 1, width: 1.5, backgroundColor: '#9ca3af' }} />
            {/* Bottom arrowhead */}
            <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '7px solid #6b7280' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
