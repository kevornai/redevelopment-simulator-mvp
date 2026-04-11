import { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | Revo",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-zinc-700">
      <h1 className="text-3xl font-bold text-zinc-900 mb-2">이용약관</h1>
      <p className="text-sm text-zinc-400 mb-10">최종 수정일: 2025년 12월 16일</p>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제1조 (목적)</h2>
        <p className="text-sm leading-relaxed">
          본 약관은 린스튜디오(이하 "회사")가 운영하는 Revo 서비스(이하 "서비스")를 이용함에 있어
          회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제2조 (서비스 내용)</h2>
        <p className="text-sm leading-relaxed">
          회사는 재개발·재건축 투자 분석 AI 리포트 및 시뮬레이션 서비스를 제공합니다.
          서비스가 제공하는 모든 분석 결과는 참고용 정보이며, 투자 권유 또는 투자 자문에 해당하지 않습니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제3조 (이용 계약의 성립)</h2>
        <p className="text-sm leading-relaxed">
          이용자가 본 약관에 동의하고 서비스 이용을 신청한 후 회사가 이를 승낙함으로써 이용 계약이 성립됩니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제4조 (서비스 이용료 및 결제)</h2>
        <ul className="text-sm leading-relaxed list-disc list-inside space-y-2">
          <li>서비스 이용료는 서비스 페이지에 게시된 가격을 기준으로 합니다.</li>
          <li>결제는 신용카드 등 회사가 지정한 결제 수단을 통해 이루어집니다.</li>
          <li>결제 완료 즉시 디지털 콘텐츠(리포트)가 제공됩니다.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제5조 (환불 및 청약철회 정책)</h2>
        <p className="text-sm leading-relaxed mb-3">
          본 서비스는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라 다음과 같이 청약철회 및 환불 정책을 운영합니다.
        </p>
        <ul className="text-sm leading-relaxed list-disc list-inside space-y-2">
          <li>
            <strong className="text-zinc-800">디지털 콘텐츠 특성상</strong>, 리포트 열람(다운로드·조회)이 시작된
            경우에는 청약철회가 제한될 수 있습니다. (동법 제17조 제2항 제5호)
          </li>
          <li>
            리포트 열람 전 취소 요청의 경우, 결제일로부터 <strong className="text-zinc-800">7일 이내</strong>에
            고객센터(30lastchance@gmail.com)로 요청 시 전액 환불됩니다.
          </li>
          <li>
            서비스 오류·장애 등 회사 귀책 사유로 인한 이용 불가의 경우 전액 환불 또는 재제공합니다.
          </li>
          <li>
            환불 처리는 요청일로부터 영업일 기준 3~5일 내 완료됩니다.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제6조 (면책 조항)</h2>
        <p className="text-sm leading-relaxed">
          본 서비스의 분석 결과는 공개된 데이터 및 알고리즘을 기반으로 한 참고 정보이며,
          실제 투자 결과를 보장하지 않습니다. 서비스 이용에 따른 투자 손실에 대해 회사는 책임을 지지 않습니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-zinc-900 mb-3">제7조 (준거법 및 관할)</h2>
        <p className="text-sm leading-relaxed">
          본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련한 분쟁은 회사 소재지를 관할하는
          법원을 전속 관할로 합니다.
        </p>
      </section>

      <div className="mt-12 pt-8 border-t border-zinc-100 text-xs text-zinc-400 space-y-1">
        <p>상호: 린스튜디오 | 대표: 신하린</p>
        <p>사업자등록번호: 510-25-10269</p>
        <p>주소: 경기도 수원시 팔달구 고등로 13, 303동 1002호</p>
        <p>문의: 30lastchance@gmail.com</p>
      </div>
    </main>
  );
}
