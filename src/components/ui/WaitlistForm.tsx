'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { joinWaitlist } from '@/app/actions/waitlist';

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full max-w-[400px] h-[52px] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold px-6 rounded-xl text-sm transition-colors duration-150"
    >
      {pending ? '처리 중...' : label}
    </button>
  );
}

function ConsentInput({ value }: { value: boolean }) {
  return <input type="hidden" name="marketing_consent" value={String(value)} />;
}

export default function WaitlistForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(joinWaitlist, null);

  // 필수: 개인정보 수집 이용 동의
  const [requiredConsent, setRequiredConsent] = useState(false);
  // 선택: 마케팅 정보 수신 동의
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<boolean | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const prevStateRef = useRef(state);
  const shakeKeyRef = useRef(0);

  if (prevStateRef.current !== state) {
    if (state?.error) shakeKeyRef.current += 1;
    prevStateRef.current = state;
  }

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  useEffect(() => {
    if (pendingConsent !== null) {
      formRef.current?.requestSubmit();
    }
  }, [pendingConsent]);

  if (state?.success) {
    return (
      <div className="animate-fade-in text-center py-6 px-6 rounded-2xl bg-blue-50 border border-blue-100">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-blue-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-zinc-800 font-semibold text-sm leading-relaxed">
          대기자 명단 등록이 완료되었습니다.
          <br />
          <span className="text-zinc-500 font-normal">
            입력하신 이메일로 가이드북이 5분 내 발송됩니다.
          </span>
        </p>
      </div>
    );
  }

  const hasError = !!state?.error;
  const effectiveMarketing = pendingConsent !== null ? pendingConsent : marketingConsent;

  function handleCTAClick(e: React.MouseEvent) {
    // 필수 동의 미체크 시 제출 자체를 막음 (버튼이 disabled이지만 방어 코드)
    if (!requiredConsent) {
      e.preventDefault();
      return;
    }
    // 선택(마케팅) 미동의 시 넛지 모달
    if (!marketingConsent) {
      e.preventDefault();
      setShowModal(true);
    }
  }

  function handleAgree() {
    setShowModal(false);
    setMarketingConsent(true);
    setPendingConsent(true);
  }

  function handleDecline() {
    setShowModal(false);
    setPendingConsent(false);
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col items-center w-full"
      >
        <ConsentInput value={effectiveMarketing} />

        {/* Email input */}
        <div
          key={shakeKeyRef.current}
          className={`w-full max-w-[400px] mb-[8px] ${hasError ? 'animate-shake' : ''}`}
        >
          <input
            type="text"
            name="email"
            placeholder="가이드북을 받을 이메일 주소"
            className={`w-full h-[48px] bg-white text-black placeholder-zinc-400 pl-[16px] pr-4 rounded-xl text-sm border transition-all duration-150 focus:outline-none focus:ring-2 ${
              hasError
                ? 'border-red-400 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100'
            }`}
          />
        </div>

        {/* Micro-copy */}
        <p className="w-full max-w-[400px] text-[11px] text-red-500 mb-[16px] whitespace-nowrap overflow-hidden text-ellipsis">
          *무료 가이드북 및 1회 분석권은 마케팅 정보 수신에 동의하신 분들께만 제공되는 한정 혜택입니다.
        </p>

        {/* 필수: 개인정보 수집 이용 동의 */}
        <div className="w-full max-w-[400px] flex items-center gap-2 mb-[8px]">
          <input
            id="required-consent"
            type="checkbox"
            checked={requiredConsent}
            onChange={(e) => setRequiredConsent(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
          />
          <label htmlFor="required-consent" className="text-[12px] text-gray-700 flex-1 cursor-pointer leading-tight">
            <span className="font-semibold">(필수)</span> 개인정보 수집 및 이용 동의
          </label>
          <button
            type="button"
            className="text-[12px] text-gray-400 underline shrink-0 hover:text-gray-600"
            onClick={() => window.open('/privacy', '_blank')}
          >
            내용 보기
          </button>
        </div>

        {/* 선택: 마케팅 정보 수신 동의 */}
        <div className="w-full max-w-[400px] flex items-center gap-2 mb-[16px]">
          <input
            id="marketing-consent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => {
              setMarketingConsent(e.target.checked);
              if (pendingConsent !== null) setPendingConsent(null);
            }}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
          />
          <label htmlFor="marketing-consent" className="text-[12px] text-gray-700 flex-1 cursor-pointer leading-tight">
            <span className="font-semibold">(선택)</span> 마케팅 정보 수신 동의
          </label>
          <button
            type="button"
            className="text-[12px] text-gray-400 underline shrink-0 hover:text-gray-600"
            onClick={() => window.open('/marketing-consent', '_blank')}
          >
            내용 보기
          </button>
        </div>

        {/* CTA — 필수 동의 미체크 시 비활성화 */}
        <div className="w-full max-w-[400px]" onClick={handleCTAClick}>
          <SubmitButton label="사전 예약하기" disabled={!requiredConsent} />
        </div>

        {!requiredConsent && (
          <p className="text-[11px] text-gray-400 mt-2">개인정보 수집 동의 후 예약 가능합니다.</p>
        )}

        {hasError && (
          <p className="text-red-500 text-xs text-center mt-2">{state.error}</p>
        )}
      </form>

      {/* 넛지 모달 — 선택(마케팅) 미동의 시 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 z-10">
            <p className="text-zinc-800 text-sm font-semibold leading-relaxed mb-2">
              잠깐, 수억 원을 방어할 가이드북 혜택을 포기하시겠습니까?
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">
              마케팅 수신에 동의하지 않으시면 사전 예약 대기자로만 등록되며{' '}
              <strong className="text-zinc-700">무료 가이드북은 발송되지 않습니다.</strong>
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleAgree}
                className="w-full h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
              >
                동의하고 가이드북 받기
              </button>
              <button
                type="button"
                onClick={handleDecline}
                className="w-full h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium rounded-xl text-sm transition-colors"
              >
                혜택 포기하고 예약만 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
