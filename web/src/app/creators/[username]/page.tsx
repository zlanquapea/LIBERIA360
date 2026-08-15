import { notFound } from 'next/navigation';
import { ApiError, getCreatorByUsername } from '@/lib/api';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username} — LIBERIA360 Creators` };
}

const SOCIAL_LINKS = [
  { key: 'instagram' as const, label: 'Instagram', prefix: 'https://instagram.com/' },
  { key: 'tiktok' as const, label: 'TikTok', prefix: 'https://tiktok.com/@' },
  { key: 'youtube' as const, label: 'YouTube', prefix: 'https://youtube.com/@' },
];

export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const creator = await getCreatorByUsername(username).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!creator) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-600 text-2xl font-semibold text-white">
          {creator.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-bold text-slate-900">
            {creator.name}
            {creator.verified && (
              <span
                aria-label="Verified creator"
                className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white"
              >
                ✓ Verified
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            @{creator.username} · {creator.followerCount.toLocaleString()} followers
          </p>
        </div>
      </div>

      {creator.bio && <p className="text-slate-700">{creator.bio}</p>}

      {(creator.instagram || creator.tiktok || creator.youtube) && (
        <div className="flex flex-wrap gap-2">
          {SOCIAL_LINKS.map(({ key, label, prefix }) => {
            const handle = creator[key];
            if (!handle) return null;
            return (
              <a
                key={key}
                href={`${prefix}${handle.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500"
              >
                {label}
              </a>
            );
          })}
        </div>
      )}

      {creator.specialties.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">Specialties</h2>
          <div className="flex flex-wrap gap-1.5">
            {creator.specialties.map((s) => (
              <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {creator.locationsCovered.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">Locations covered</h2>
          <div className="flex flex-wrap gap-1.5">
            {creator.locationsCovered.map((l) => (
              <span key={l} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {l}
              </span>
            ))}
          </div>
        </section>
      )}

      {creator.contentLinks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">Featured content</h2>
          <ul className="flex flex-col gap-1.5">
            {creator.contentLinks.map((link) => (
              <li key={link}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-brand-700 hover:underline"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
