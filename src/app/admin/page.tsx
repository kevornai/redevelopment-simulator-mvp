'use client';

import { useState } from 'react';
import { sendMarketingEmail } from '@/app/actions/adminEmail';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '1111';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ sent?: number; error?: string } | null>(null);

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setPwError(true);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setStatus('sending');
    setResult(null);
    try {
      const res = await sendMarketingEmail({
        subject,
        bodyHtml: body,
        ctaText: ctaText || undefined,
        ctaUrl: ctaUrl || undefined,
      });
      setResult({ sent: res.sent });
      setStatus('done');
    } catch (e) {
      setResult({ error: String(e) });
      setStatus('error');
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 w-full max-w-sm">
          <h1 className="text-zinc-900 font-bold text-xl mb-1">Revo 어드민</h1>
          <p className="text-zinc-400 text-sm mb-6">마케팅 이메일 발송 관리</p>
          <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className={`w-full h-11 px-4 rounded-xl border text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
              pwError ? 'border-red-400' : 'border-zinc-300'
            }`}
          />
          {pwError && <p className="text-red-500 text-xs mb-3">비밀번호가 올바르지 않습니다.</p>}
          <button
            onClick={handleLogin}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-zinc-900 font-bold text-2xl mb-1">마케팅 이메일 발송</h1>
          <p className="text-zinc-400 text-sm">
            <code className="bg-zinc-100 px-1 rounded text-xs">marketing_consent = true</code> 유저 전체에게 발송됩니다.
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 space-y-5">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
              이메일 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: [Revo] 정식 서비스 출시 안내"
              className="w-full h-11 px-4 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          {/* 본문 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
              본문 (HTML 가능) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'예: <p>안녕하세요, Revo입니다.</p>\n<p>드디어 정식 서비스가 출시되었습니다.</p>'}
              rows={8}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none font-mono"
            />
          </div>

          {/* CTA 버튼 (선택) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                버튼 텍스트 <span className="text-zinc-400 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="지금 바로 분석하기"
                className="w-full h-11 px-4 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                버튼 URL <span className="text-zinc-400 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://revo-invest.com"
                className="w-full h-11 px-4 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 발송 버튼 */}
          <button
            onClick={handleSend}
            disabled={!subject.trim() || !body.trim() || status === 'sending'}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors"
          >
            {status === 'sending' ? '발송 중...' : '전체 발송하기'}
          </button>

          {/* 결과 */}
          {status === 'done' && result?.sent !== undefined && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
              ✅ {result.sent}명에게 발송 완료되었습니다.
            </div>
          )}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              ❌ 오류: {result?.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
