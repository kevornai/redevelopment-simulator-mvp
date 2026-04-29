import Image from 'next/image';

const NAV_LINKS = [
  { href: '/blog', label: '블로그' },
  { href: '/#how-it-works', label: '서비스 소개' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href="/">
          <Image
            src="/logo.png"
            alt="Revo"
            width={320}
            height={100}
            className="h-20 w-auto object-contain"
            priority
          />
        </a>

        <div className="flex items-center gap-6">
          <nav className="hidden sm:flex items-center gap-5">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href="/#waitlist"
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors duration-150"
          >
            사전 예약하기
          </a>
        </div>
      </div>
    </header>
  );
}
