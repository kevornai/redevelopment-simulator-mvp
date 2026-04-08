'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { joinWaitlist } from '@/app/actions/waitlist';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 px-6 rounded-xl text-sm transition-colors duration-150"
    >
      {pending ? '처리 중...' : '무료 분석권 및 가이드북 받기'}
    </button>
  );
}

export default function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlist, null);

  const prevStateRef = useRef(state);
  const shakeKeyRef = useRef(0);
  if (prevStateRef.current !== state) {
    if (state?.error) shakeKeyRef.current += 1;
    prevStateRef.current = state;
  }

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

  return (
    <form action={formAction} className="flex flex-col gap-2.5 w-full">
      <div key={shakeKeyRef.current} className={hasError ? 'animate-shake' : ''}>
        <input
          type="text"
          name="email"
          placeholder="자주 확인하시는 이메일 주소를 입력해 주세요"
          className={`w-full bg-white text-zinc-900 placeholder-zinc-400 py-3.5 px-4 rounded-xl text-sm border transition-all duration-150 focus:outline-none focus:ring-2 ${
            hasError
              ? 'border-red-400 focus:ring-red-200'
              : 'border-zinc-300 focus:border-blue-500 focus:ring-blue-100'
          }`}
        />
      </div>
      <SubmitButton />
      {hasError && (
        <p className="text-red-500 text-xs text-center">{state.error}</p>
      )}
    </form>
  );
}
