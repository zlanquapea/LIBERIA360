import Link from "next/link";

export function CreatorFeedTabs({
  mode,
}: {
  mode: "discover" | "following" | "latest";
}) {
  return (
    <nav
      aria-label="Creator feed"
      className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-sm dark:bg-slate-900"
    >
      {(
        [
          ["discover", "For You", "/creators"],
          ["following", "Following", "/creators?view=following"],
          ["latest", "Latest", "/creators?view=latest"],
        ] as const
      ).map(([value, label, href]) => (
        <Link
          key={value}
          href={href}
          aria-current={mode === value ? "page" : undefined}
          className={`flex min-h-12 items-center justify-center rounded-full px-2 text-sm font-bold ${mode === value ? "bg-brand-800 text-white dark:bg-emerald-300 dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
