'use client';

import { useState } from 'react';
import { sendMarketingEmail } from '@/app/actions/adminEmail';
type GyeonggiApiRow = {
  SIGUN_NM: string;
  SIGUN_CD: string;
  BIZ_TYPE_NM: string;
  IMPRV_ZONE_NM: string;
  IMPRV_ZONE_APPONT_FIRST_DE: string | null;
  PROPLSN_COMMISN_APRV_DE: string | null;
  ASSOCTN_FOUND_CONFMTN_DE: string | null;
  BIZ_IMPLMTN_CONFMTN_DE: string | null;
  MANAGE_DISPOSIT_CONFMTN_DE: string | null;
  STRCONTR_DE: string | null;
  GENRL_LOTOUT_DE: string | null;
  COMPLTN_DE: string | null;
};

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

  const [syncStatus, setSyncStatus] = useState<'idle' | 'fetching' | 'saving' | 'done' | 'error'>('idle');
  const [syncResult, setSyncResult] = useState<{ saved?: number; updated?: number; inserted?: number; error?: string } | null>(null);

  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [geocodeProgress, setGeocodeProgress] = useState<{ success: number; failed: number; remaining: number } | null>(null);

  async function handleGeocode() {
    setGeocodeStatus('running');
    setGeocodeProgress(null);
    let totalSuccess = 0;
    let totalFailed = 0;
    let prevRemaining = -1;
    try {
      while (true) {
        const res = await fetch('/api/admin/geocode-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 20 }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? '오류');
        totalSuccess += d.success ?? 0;
        totalFailed += d.failed ?? 0;
        const remaining = d.remaining ?? 0;
        setGeocodeProgress({ success: totalSuccess, failed: totalFailed, remaining });
        if (d.done || remaining === 0) break;
        // 진전 없으면 중단 (전부 실패한 배치)
        if (remaining === prevRemaining && (d.success ?? 0) === 0) break;
        prevRemaining = remaining;
      }
      setGeocodeStatus('done');
    } catch (e) {
      setGeocodeStatus('error');
      setGeocodeProgress(prev => ({ success: prev?.success ?? 0, failed: prev?.failed ?? 0, remaining: -1 }));
    }
  }

  async function handleGyeonggiSync() {
    setSyncStatus('fetching');
    setSyncResult(null);
    try {
      const API_KEY = '6f7cae6f12fb49dea44a0f30e1611919';
      const allRows: GyeonggiApiRow[] = [];
      let page = 1;
      let total = Infinity;

      while (allRows.length < total) {
        const url = `https://openapi.gg.go.kr/GenrlimprvBizpropls?KEY=${API_KEY}&Type=json&pIndex=${page}&pSize=100`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const root = data?.GenrlimprvBizpropls ?? [];
        if (!root || root.length < 2) break;
        if (total === Infinity) total = root[0]?.head?.[0]?.list_total_count ?? 0;
        const rows = root[1]?.row ?? [];
        if (!rows.length) break;
        allRows.push(...rows);
        page++;
      }

      setSyncStatus('saving');
      const res = await fetch('/api/admin/sync-gyeonggi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allRows),
      });
      const saveResult = await res.json();
      setSyncResult(saveResult);
      setSyncStatus(saveResult.error ? 'error' : 'done');
    } catch (e) {
      setSyncResult({ error: String(e) });
      setSyncStatus('error');
    }
  }

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
      <div className="max-w-2xl mx-auto space-y-8">

        {/* 경기도 단계 날짜 동기화 */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-zinc-900 font-bold text-lg mb-1">경기도 단계 날짜 동기화</h2>
          <p className="text-zinc-400 text-sm mb-4">
            경기도 데이터드림 API → zones 테이블에 직접 저장합니다.<br/>
            <span className="text-amber-500">한국 IP에서만 동작합니다. (경기도 API 해외 IP 차단)</span>
          </p>
          <button
            onClick={handleGyeonggiSync}
            disabled={syncStatus === 'fetching' || syncStatus === 'saving'}
            className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors"
          >
            {syncStatus === 'fetching' ? '경기도 API 수집 중...' : syncStatus === 'saving' ? 'DB 저장 중...' : '경기도 데이터 동기화'}
          </button>
          {syncStatus === 'done' && syncResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
              ✅ 수집 {syncResult.saved}건 · 업데이트 {syncResult.updated}건 · 신규 {syncResult.inserted}건
            </div>
          )}
          {syncStatus === 'error' && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              ❌ {syncResult?.error}
            </div>
          )}
        </div>

        {/* 좌표 일괄 채우기 */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-zinc-900 font-bold text-lg mb-1">구역 좌표 자동 채우기</h2>
          <p className="text-zinc-400 text-sm mb-4">
            lat/lng 없는 구역을 카카오 API로 일괄 지오코딩합니다.<br/>
            경기도 동기화 후 한 번 실행하세요.
          </p>
          <button
            onClick={handleGeocode}
            disabled={geocodeStatus === 'running'}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors"
          >
            {geocodeStatus === 'running' ? `좌표 채우는 중... (남은 ${geocodeProgress?.remaining ?? '?'}건)` : '좌표 일괄 채우기'}
          </button>
          {geocodeStatus === 'done' && geocodeProgress && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
              ✅ 완료 — 성공 {geocodeProgress.success}건 · 실패 {geocodeProgress.failed}건
            </div>
          )}
          {geocodeStatus === 'error' && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              ❌ 오류 발생 (성공 {geocodeProgress?.success ?? 0}건 처리됨)
            </div>
          )}
        </div>

        <div>
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
