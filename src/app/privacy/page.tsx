import { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | Revo",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-zinc-700">
      <h1 className="text-3xl font-bold text-zinc-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-zinc-400 mb-10">최종 수정일: 2025년 12월 16일</p>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제1조 (개인정보 수집 항목 및 목적)</h2>
        <p className="text-sm leading-relaxed mb-3">
          린스튜디오(이하 "회사")는 다음의 목적을 위해 최소한의 개인정보를 수집합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse border border-zinc-200">
            <thead>
              <tr className="bg-zinc-50">
                <th className="border border-zinc-200 px-4 py-2 text-left font-semibold text-zinc-800">수집 항목</th>
                <th className="border border-zinc-200 px-4 py-2 text-left font-semibold text-zinc-800">수집 목적</th>
                <th className="border border-zinc-200 px-4 py-2 text-left font-semibold text-zinc-800">보유 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-zinc-200 px-4 py-2">이메일 주소</td>
                <td className="border border-zinc-200 px-4 py-2">사전 예약 안내, 서비스 출시 알림</td>
                <td className="border border-zinc-200 px-4 py-2">동의 철회 시까지</td>
              </tr>
              <tr>
                <td className="border border-zinc-200 px-4 py-2">이메일 주소</td>
                <td className="border border-zinc-200 px-4 py-2">결제 확인 및 리포트 전달</td>
                <td className="border border-zinc-200 px-4 py-2">5년 (전자상거래법)</td>
              </tr>
              <tr>
                <td className="border border-zinc-200 px-4 py-2">결제 정보 (카드사 처리)</td>
                <td className="border border-zinc-200 px-4 py-2">결제 처리 (PG사 직접 처리, 회사 미보관)</td>
                <td className="border border-zinc-200 px-4 py-2">해당 없음</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제2조 (개인정보의 제3자 제공)</h2>
        <p className="text-sm leading-relaxed">
          회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 결제 처리를 위해
          포트원(주) 및 토스페이먼츠(주)에 결제 관련 정보가 전달될 수 있으며, 이는 결제 서비스
          제공 목적에 한정됩니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제3조 (개인정보 처리 위탁)</h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse border border-zinc-200">
            <thead>
              <tr className="bg-zinc-50">
                <th className="border border-zinc-200 px-4 py-2 text-left font-semibold text-zinc-800">수탁업체</th>
                <th className="border border-zinc-200 px-4 py-2 text-left font-semibold text-zinc-800">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-zinc-200 px-4 py-2">Supabase Inc.</td>
                <td className="border border-zinc-200 px-4 py-2">데이터베이스 및 서버 인프라 운영</td>
              </tr>
              <tr>
                <td className="border border-zinc-200 px-4 py-2">포트원(주)</td>
                <td className="border border-zinc-200 px-4 py-2">결제 연동 처리</td>
              </tr>
              <tr>
                <td className="border border-zinc-200 px-4 py-2">토스페이먼츠(주)</td>
                <td className="border border-zinc-200 px-4 py-2">신용카드 결제 처리</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제4조 (이용자의 권리)</h2>
        <p className="text-sm leading-relaxed">
          이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.
          요청은 아래 개인정보 보호 담당자에게 이메일로 연락하시기 바랍니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제5조 (쿠키 및 분석 도구)</h2>
        <p className="text-sm leading-relaxed">
          회사는 서비스 개선을 위해 Google Tag Manager, Microsoft Clarity 등의 분석 도구를 사용합니다.
          이를 통해 방문자 행동 데이터(비식별)가 수집될 수 있습니다. 브라우저 설정을 통해 쿠키 수집을 거부할 수 있습니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제6조 (개인정보 보호 담당자)</h2>
        <ul className="text-sm leading-relaxed list-none space-y-1">
          <li>담당자: 신하린</li>
          <li>이메일: 30lastchance@gmail.com</li>
          <li>
            개인정보 침해 신고: 개인정보보호위원회{" "}
            <a href="https://www.privacy.go.kr" className="underline text-blue-600" target="_blank" rel="noopener noreferrer">
              privacy.go.kr
            </a>{" "}
            / 국번 없이 182
          </li>
        </ul>
      </section>

      <div className="mt-12 pt-8 border-t border-zinc-100 text-xs text-zinc-400 space-y-1">
        <p>상호: 린스튜디오 | 대표: 신하린</p>
        <p>사업자등록번호: 510-25-10269</p>
        <p>주소: 경기도 수원시 팔달구 고등로 13, 303동 1002호</p>
      </div>
    </main>
  );
}
