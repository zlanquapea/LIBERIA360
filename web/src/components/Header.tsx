import Image from "next/image";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { AccountLink } from "./AccountLink";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between bg-brand-900 px-3 py-1.5 text-white shadow-[0_8px_24px_rgba(8,26,80,0.16)] sm:px-6 sm:py-2 lg:px-10">
      <Link href="/" className="group flex items-center">
        <Image
          src="/logo.png"
          alt="LIBERIA360"
          width={160}
          height={160}
          priority
          className="h-12 w-12 object-contain transition-transform duration-300 group-hover:scale-105 sm:h-[4.5rem] sm:w-[4.5rem]"
        />
        <span className="sr-only">
          LIBERIA360 — Everything Liberia. One Place.
        </span>
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          href="/search"
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/30 bg-white/5 px-2.5 py-1.5 text-sm text-white/90 transition-colors hover:border-white hover:bg-white hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:px-3"
        >
          <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
          Search
        </Link>
        <ThemeToggle />
        <NotificationBell />
        <AccountLink />
      </div>
    </header>
  );
}
