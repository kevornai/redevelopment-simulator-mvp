'use client';

import { useState } from 'react';

function formatWon(manwon: number): string {
  if (!isFinite(manwon)) return '—';
  const abs = Math.abs(manwon);
  const sign = manwon < 0 ? '-' : '';
  if (abs >= 10000) {
    const uk = Math.floor(abs / 10000);
    const man = Math.round(abs % 10000);
    return man > 0
      ? `${sign}${uk}억 ${man.toLocaleString()}만`
      : `${sign}${uk}억`;
  }
  return `${sign}${Math.round(abs).toLocaleString()}만`;
}

function parse(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

interface InputRowProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function InputRow({ label, hint, value, onChange, placeholder }: InputRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-700">{label}</p>
        {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0'}
          className="w-28 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <span className="text-xs text-zinc-400 w-6">만원</span>
      </div>
    </div>
  );
}

export default function AssetCalculator() {
  const [cash, setCash] = useState('');
  const [invest, setInvest] = useState('');
  const [debt, setDebt] = useState('');
  const [loan, setLoan] = useState('');
  const [monthly, setMonthly] = useState('');
  const [misc, setMisc] = useState('');

  const cashN = parse(cash);
  const investN = parse(invest);
  const debtN = parse(debt);
  const loanN = parse(loan);
  const monthlyN = parse(monthly);
  const miscN = parse(misc);

  const netWorth = cashN + investN - debtN;
  const interestBuf = loanN * 0.04;          // 2% × 24개월
  const incomeBuf = monthlyN * 6;
  const totalBuf = interestBuf + incomeBuf + miscN;
  const available = netWorth - totalBuf;

  const hasInput = cashN || investN || debtN || loanN || monthlyN || miscN;

  return (
    <div className="bg-zinc-50 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">STEP 1 — 현재 자산</p>
        <div>
          <InputRow label="현금 + 예적금" value={cash} onChange={setCash} placeholder="15000" />
          <InputRow label="투자 자산" hint="주식, 펀드 등 현금화 가능한 것" value={invest} onChange={setInvest} placeholder="8000" />
          <InputRow label="현재 부채" hint="기존 대출, 카드론 등" value={debt} onChange={setDebt} placeholder="5000" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">STEP 2 — 최악의 시나리오</p>
        <div>
          <InputRow
            label="예상 담보대출"
            hint="매수 후 받을 대출 금액 (금리 상승 계산 기준)"
            value={loan}
            onChange={setLoan}
            placeholder="30000"
          />
          <InputRow label="월 생활비" hint="6개월치 완충 계산" value={monthly} onChange={setMonthly} placeholder="300" />
          <InputRow label="연간 예비비" hint="의료·교육·수리 등 비예측 지출" value={misc} onChange={setMisc} placeholder="500" />
        </div>
      </div>

      <div className="border-t-2 border-zinc-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-zinc-500">
          <span>순자산 (A)</span>
          <span className="font-medium text-zinc-700">{hasInput ? formatWon(netWorth) : '—'}</span>
        </div>
        <div className="flex justify-between text-sm text-zinc-400">
          <span>금리 2% 상승 완충 (2년)</span>
          <span>{hasInput ? formatWon(interestBuf) : '—'}</span>
        </div>
        <div className="flex justify-between text-sm text-zinc-400">
          <span>소득 중단 완충 (6개월)</span>
          <span>{hasInput ? formatWon(incomeBuf) : '—'}</span>
        </div>
        <div className="flex justify-between text-sm text-zinc-400">
          <span>예비비</span>
          <span>{hasInput ? formatWon(miscN) : '—'}</span>
        </div>
        <div className="flex justify-between text-sm text-zinc-500 border-t border-zinc-200 pt-2">
          <span>완충액 합계 (B)</span>
          <span className="font-medium text-zinc-700">{hasInput ? formatWon(totalBuf) : '—'}</span>
        </div>
        <div className="flex justify-between items-center bg-white rounded-xl px-4 py-3 border border-zinc-200 mt-1">
          <span className="font-semibold text-zinc-800">실제 가용 자산 (A − B)</span>
          <span
            className={`text-xl font-bold ${
              !hasInput
                ? 'text-zinc-300'
                : available < 0
                ? 'text-red-500'
                : 'text-blue-600'
            }`}
          >
            {hasInput ? formatWon(available) : '—'}
          </span>
        </div>
        {hasInput && available < 0 && (
          <p className="text-xs text-red-500 text-center pt-1">
            완충액이 순자산을 초과합니다. 매수 상한을 낮추거나 대출을 줄이는 것을 고려하세요.
          </p>
        )}
        {hasInput && available >= 0 && (
          <p className="text-xs text-zinc-400 text-center pt-1">
            이 금액이 최악의 상황에서도 버틸 수 있는 매수 하한선입니다.
          </p>
        )}
      </div>
    </div>
  );
}
