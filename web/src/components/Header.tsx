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
      <div className="mx-auto flex min-h-[4.5rem] max-w-[90rem] items-center justify-between gap-3 px-3 py-1.5 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          aria-label="LIBERIA360 home"
        >
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-white/20 sm:h-14 sm:w-14">
          <Image
            src="/logo.png"
            alt="LIBERIA360"
            width={160}
            height={160}
            priority
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
          </span>
          <span className="ml-2 hidden font-display text-sm font-extrabold tracking-[0.05em] sm:inline">
            LIBERIA<span className="text-gold-400">360</span>
          </span>
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
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90 transition-all hover:border-white hover:bg-white hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
          </Link>
          <ThemeToggle />
          <NotificationBell />
          <AccountLink />
        </div>
      </div>
    </header>
  );
}
