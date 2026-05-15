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
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-zinc-700">{label}</p>
        {hint && <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0'}
          className="w-32 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <span className="text-xs text-zinc-400 w-7 shrink-0">만원</span>
      </div>
    </div>
  );
}

interface ResultRowProps {
  label: string;
  value: string;
  bold?: boolean;
  dim?: boolean;
}

function ResultRow({ label, value, bold, dim }: ResultRowProps) {
  return (
    <div className={`flex justify-between text-sm ${dim ? 'text-zinc-400' : 'text-zinc-600'}`}>
      <span className={bold ? 'font-semibold text-zinc-800' : ''}>{label}</span>
      <span className={bold ? 'font-semibold text-zinc-800' : ''}>{value}</span>
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
  const [takTax, setTakTax] = useState('');
  const [regFee, setRegFee] = useState('');
  const [agentFee, setAgentFee] = useState('');
  const [interior, setInterior] = useState('');
  const [extras, setExtras] = useState<{ label: string; amount: string }[]>([{ label: '', amount: '' }]);
  const [calculated, setCalculated] = useState(false);

  const cashN = parse(cash);
  const investN = parse(invest);
  const debtN = parse(debt);
  const loanN = parse(loan);
  const monthlyN = parse(monthly);
  const miscN = parse(misc);
  const takTaxN = parse(takTax);
  const regFeeN = parse(regFee);
  const agentFeeN = parse(agentFee);
  const interiorN = parse(interior);
  const extrasTotal = extras.reduce((sum, e) => sum + parse(e.amount), 0);

  const netWorth = cashN + investN - debtN;
  const interestBuf = loanN * 0.04;
  const incomeBuf = monthlyN * 6;
  const purchaseCosts = takTaxN + regFeeN + agentFeeN + interiorN;
  const totalBuf = interestBuf + incomeBuf + miscN + purchaseCosts + extrasTotal;
  const available = netWorth - totalBuf;

  const hasInput = cashN > 0 || investN > 0;

  function addExtra() {
    setExtras(prev => [...prev, { label: '', amount: '' }]);
  }

  function updateExtra(i: number, field: 'label' | 'amount', val: string) {
    setExtras(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }

  function removeExtra(i: number) {
    setExtras(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleReset() {
    setCash(''); setInvest(''); setDebt('');
    setLoan(''); setMonthly(''); setMisc('');
    setTakTax(''); setRegFee(''); setAgentFee(''); setInterior('');
    setExtras([{ label: '', amount: '' }]);
    setCalculated(false);
  }

  return (
    <div className="space-y-3">

      {/* 입력 섹션 */}
      <div className="bg-zinc-50 rounded-2xl p-5 space-y-5">

        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            STEP 1 — 현재 자산
          </p>
          <div>
            <InputRow label="현금 + 예적금" value={cash} onChange={setCash} placeholder="15000" />
            <InputRow
              label="투자 자산"
              hint="주식, 펀드 등 현금화 가능한 것"
              value={invest}
              onChange={setInvest}
              placeholder="8000"
            />
            <InputRow
              label="현재 부채"
              hint="기존 대출, 카드론 등"
              value={debt}
              onChange={setDebt}
              placeholder="5000"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            STEP 2 — 최악의 시나리오
          </p>
          <div>
            <InputRow
              label="예상 담보대출"
              hint="매수 후 받을 대출 금액"
              value={loan}
              onChange={setLoan}
              placeholder="30000"
            />
            <InputRow
              label="월 생활비"
              hint="6개월치 완충 계산"
              value={monthly}
              onChange={setMonthly}
              placeholder="300"
            />
            <InputRow
              label="연간 예비비"
              hint="의료·교육·수리 등 비예측 지출"
              value={misc}
              onChange={setMisc}
              placeholder="500"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            STEP 3 — 매수 부대비용
          </p>
          <div>
            <InputRow
              label="취득세"
              hint="일반적으로 매수가의 1~3% (1주택 기준)"
              value={takTax}
              onChange={setTakTax}
              placeholder="1500"
            />
            <InputRow
              label="등기비용"
              hint="법무사 수수료 + 등록면허세 등"
              value={regFee}
              onChange={setRegFee}
              placeholder="150"
            />
            <InputRow
              label="중개수수료"
              hint="매수가의 0.4~0.9%"
              value={agentFee}
              onChange={setAgentFee}
              placeholder="200"
            />
            <InputRow
              label="인테리어 예산"
              hint="입주 전 수리·인테리어 예상 비용"
              value={interior}
              onChange={setInterior}
              placeholder="1000"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            STEP 4 — 기타 비용 (직접 입력)
          </p>
          <div className="space-y-2">
            {extras.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={e.label}
                  onChange={ev => updateExtra(i, 'label', ev.target.value)}
                  placeholder="항목명 (예: 이사비)"
                  className="flex-1 min-w-0 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={e.amount}
                  onChange={ev => updateExtra(i, 'amount', ev.target.value)}
                  placeholder="0"
                  className="w-28 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-zinc-400 shrink-0">만원</span>
                {extras.length > 1 && (
                  <button
                    onClick={() => removeExtra(i)}
                    className="text-zinc-300 hover:text-red-400 text-lg leading-none shrink-0"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addExtra}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium mt-1"
            >
              + 항목 추가
            </button>
          </div>
        </div>
      </div>

      {/* 계산 버튼 */}
      {!calculated ? (
        <button
          onClick={() => { if (hasInput) setCalculated(true); }}
          disabled={!hasInput}
          className={`w-full font-semibold py-3 px-6 rounded-xl text-sm transition-colors ${
            hasInput
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
        >
          가용 자산 계산하기
        </button>
      ) : (
        <button
          onClick={handleReset}
          className="w-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50 font-medium py-3 px-6 rounded-xl text-sm transition-colors"
        >
          다시 계산하기
        </button>
      )}

      {/* 결과 섹션 */}
      {calculated && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">

          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">계산 결과</p>

          <div className="space-y-2">
            <ResultRow label="순자산 (A)" value={formatWon(netWorth)} bold />
            <div className="border-t border-zinc-100 pt-2 space-y-1.5">
              <p className="text-xs text-zinc-400 font-medium">완충액</p>
              <ResultRow label="금리 2% 상승 완충 (2년)" value={formatWon(interestBuf)} dim />
              <ResultRow label="소득 중단 완충 (6개월)" value={formatWon(incomeBuf)} dim />
              <ResultRow label="예비비" value={formatWon(miscN)} dim />
            </div>
            {purchaseCosts > 0 && (
              <div className="border-t border-zinc-100 pt-2 space-y-1.5">
                <p className="text-xs text-zinc-400 font-medium">매수 부대비용</p>
                {takTaxN > 0 && <ResultRow label="취득세" value={formatWon(takTaxN)} dim />}
                {regFeeN > 0 && <ResultRow label="등기비용" value={formatWon(regFeeN)} dim />}
                {agentFeeN > 0 && <ResultRow label="중개수수료" value={formatWon(agentFeeN)} dim />}
                {interiorN > 0 && <ResultRow label="인테리어" value={formatWon(interiorN)} dim />}
              </div>
            )}
            {extrasTotal > 0 && (
              <div className="border-t border-zinc-100 pt-2 space-y-1.5">
                <p className="text-xs text-zinc-400 font-medium">기타 비용</p>
                {extras.filter(e => parse(e.amount) > 0).map((e, i) => (
                  <ResultRow
                    key={i}
                    label={e.label || `기타 ${i + 1}`}
                    value={formatWon(parse(e.amount))}
                    dim
                  />
                ))}
              </div>
            )}
            <div className="border-t border-zinc-100 pt-2">
              <ResultRow label="공제 합계 (B)" value={formatWon(totalBuf)} bold />
            </div>
          </div>

          {/* 최종 결과 */}
          <div
            className={`rounded-xl px-4 py-4 text-center ${
              available < 0 ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'
            }`}
          >
            <p className="text-xs text-zinc-500 mb-1">실제 가용 자산 (A − B)</p>
            <p
              className={`text-2xl font-bold ${
                available < 0 ? 'text-red-500' : 'text-blue-600'
              }`}
            >
              {formatWon(available)}
            </p>
            <p className={`text-xs mt-2 ${available < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {available < 0
                ? '완충액이 순자산을 초과합니다. 매수 상한을 낮추거나 대출을 줄여보세요.'
                : '이 금액이 최악의 상황에서도 버틸 수 있는 매수 상한선입니다.'}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
