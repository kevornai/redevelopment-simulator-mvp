import Image from 'next/image';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href="/">
          <Image
            src="/logo.png"
            alt="Revo"
            width={120}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
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
