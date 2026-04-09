const sliders = [
  { label: '평당 공사비 인상률', value: 95, unit: '+28%' },
  { label: '대출 금리 변동', value: 85, unit: '+2.1%p' },
];

export default function CostVolatilityPanel() {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6 flex flex-col justify-between">
      <div className="space-y-6">
        <p className="text-slate-900 font-bold text-sm tracking-wide">비용 변동성 시뮬레이션</p>

        <div className="space-y-5">
          {sliders.map((s) => (
            <div key={s.label}>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">{s.label}</span>
                <span className="font-semibold text-red-600">{s.unit}</span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden cursor-not-allowed">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-red-400"
                  style={{ width: `${s.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-md p-4 space-y-1.5">
        <p className="text-sm text-slate-400 line-through">
          조합 브리핑 예상 분담금: 1.5억원
        </p>
        <p className="text-2xl font-extrabold text-red-600">
          최악의 예상 분담금: 3.8억원
        </p>
      </div>
    </div>
  );
}
