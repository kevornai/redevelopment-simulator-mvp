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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-zinc-400 text-xs">
            문의:{' '}
            <a
              href="mailto:contact@example.com"
              className="hover:text-zinc-700 transition-colors"
            >
              contact@example.com
            </a>
          </p>
          <p className="text-zinc-300 text-xs">
            Copyright ⓒ 분담금 계산기. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
