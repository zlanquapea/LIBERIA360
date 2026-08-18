import Image from 'next/image';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { AccountLink } from './AccountLink';

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
      <Link href="/" className="group flex items-center">
        <Image
          src="/logo.png"
          alt="LIBERIA360"
          width={160}
          height={160}
          priority
          className="h-14 w-14 object-contain transition-transform duration-300 group-hover:scale-105"
        />
        <span className="sr-only">LIBERIA360 — Everything Liberia. One Place.</span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/search"
          className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
        >
          <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
          Search
        </Link>
        <AccountLink />
      </div>
    </header>
  );
}
