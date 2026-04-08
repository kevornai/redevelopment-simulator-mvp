export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <a href="/" className="font-bold text-lg text-zinc-900 tracking-tight">
          Revo
        </a>
        <a
          href="#waitlist"
          className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors duration-150"
        >
          대기자 명단 등록
        </a>
      </div>
    </header>
  );
}
