import Image from "next/image";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { AccountLink } from "./AccountLink";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

const desktopNavigation = [
  { href: "/explore", label: "Explore" },
  { href: "/counties", label: "Counties" },
  { href: "/events", label: "Events" },
  { href: "/businesses", label: "Businesses" },
  { href: "/creators", label: "Creators" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-900/95 text-white shadow-[0_8px_24px_rgba(8,26,80,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-brand-900/90">
      <div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-3 py-1.5 sm:px-6 sm:py-2 lg:px-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          aria-label="LIBERIA360 home"
        >
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
        <nav
          aria-label="Main navigation"
          className="hidden min-w-0 items-center justify-center gap-1 lg:flex"
        >
          {desktopNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-brand-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
      </div>
    </header>
  );
}
