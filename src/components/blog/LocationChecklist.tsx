'use client';

import { useState } from 'react';

const CRITERIA = [
  {
    label: '역세권 (도보 10분 이내)',
    consequence: '수요층이 좁아져 급할 때 안 팔립니다.',
  },
  {
    label: '대단지 (500세대 이상)',
    consequence: '단지 내 거래가 드물어 가격 방어가 안 됩니다.',
  },
  {
    label: '실거래 월 3건 이상',
    consequence: '거래량이 없으면 내가 원하는 가격에 팔기 어렵습니다.',
  },
  {
    label: '개발 호재 또는 학군',
    consequence: '미래 수요를 끌어당길 요소가 없습니다.',
  },
  {
    label: '선호 조건 충족 (층·향·동)',
    consequence: '2층, 북향, 끝 동은 가장 먼저 외면받습니다.',
  },
];

export default function LocationChecklist() {
  const [checked, setChecked] = useState<boolean[]>(CRITERIA.map(() => false));

  const toggle = (i: number) =>
    setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const count = checked.filter(Boolean).length;

  return (
    <div className="bg-zinc-50 rounded-2xl p-6 space-y-3">
      {CRITERIA.map((c, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className="w-full text-left flex items-start gap-3 group"
        >
          <span
            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
              checked[i]
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-zinc-300 bg-white group-hover:border-blue-400'
            }`}
          >
            {checked[i] && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <div>
            <p className={`text-sm font-medium transition-colors ${checked[i] ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>
              {c.label}
            </p>
            {!checked[i] && (
              <p className="text-xs text-zinc-400 mt-0.5">{c.consequence}</p>
            )}
          </div>
        </button>
      ))}

      <div className="border-t border-zinc-200 pt-3 flex items-center justify-between">
        <span className="text-sm text-zinc-500">충족 항목</span>
        <span
          className={`text-sm font-bold ${
            count >= 3 ? 'text-blue-600' : 'text-orange-500'
          }`}
        >
          {count} / {CRITERIA.length}
          {count >= 3 ? ' ✓ 최소 기준 충족' : ' — 최소 3개 필요'}
        </span>
      </div>
    </div>
  );
}
