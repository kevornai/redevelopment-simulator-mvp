export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="font-bold text-lg text-zinc-900 tracking-tight">
          분담금 계산기
        </a>

        {/* Nav buttons — mirrors kleo: Sign In (ghost) + Start here (filled) */}
        <div className="flex items-center gap-2">
          <a
            href="#waitlist"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 px-4 py-2 rounded-lg transition-colors duration-150"
          >
            로그인
          </a>
          <a
            href="#waitlist"
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors duration-150"
          >
            대기자 명단 등록
          </a>
        </div>
      </div>
    </header>
  );
}
