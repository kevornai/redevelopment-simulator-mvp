// kleo footer: light-1 section (white bg), dark text is text-zinc-500
export default function Footer() {
  return (
    <footer className="bg-white border-t border-zinc-200 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-zinc-400 text-xs leading-relaxed mb-5">
          <strong className="text-zinc-500">면책 조항:</strong>{' '}
          본 서비스가 제공하는 모든 시뮬레이션 결과 및 분석 리포트는 참고용 정보에 불과하며,
          특정 투자 상품에 대한 매수·매도 또는 투자 결정을 권유하거나 유도하지 않습니다.
          재개발·재건축 투자는 시장 상황, 법규 변경, 조합 운영 등 다양한 요인에 의해 실제
          결과와 크게 다를 수 있으며, 모든 투자 결정과 그에 따른 손실에 대한 책임은 투자자
          본인에게 있습니다.
        </p>

        {/* 사업자 정보 */}
        <p className="text-zinc-400 text-xs leading-relaxed mb-5">
          상호: 린스튜디오 &nbsp;|&nbsp; 대표: 신하린 &nbsp;|&nbsp; 사업자등록번호: 510-25-10269
          <br />
          주소: 경기도 수원시 팔달구 고등로 13, 303동 1002호 (고등동, 수원역푸르지오더스마트)
          <br />
          업태: 정보통신업 &nbsp;|&nbsp; 종목: 미디어콘텐츠창작업
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-zinc-400 text-xs">
            문의:{' '}
            <a
              href="mailto:30lastchance@gmail.com"
              className="hover:text-zinc-700 transition-colors"
            >
              30lastchance@gmail.com
            </a>
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <a href="/terms" className="hover:text-zinc-700 transition-colors">이용약관</a>
            <a href="/privacy" className="hover:text-zinc-700 transition-colors">개인정보처리방침</a>
          </div>
          <p className="text-zinc-300 text-xs">
            Copyright ⓒ 린스튜디오. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
