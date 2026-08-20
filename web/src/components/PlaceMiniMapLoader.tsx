'use client';

import dynamic from 'next/dynamic';

const PlaceMiniMapClient = dynamic(() => import('./PlaceMiniMapClient').then((mod) => mod.PlaceMiniMapClient), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">Map…</div>,
});

export function PlaceMiniMapLoader(props: { latitude: number; longitude: number; color: string; icon: string | null }) {
  return <PlaceMiniMapClient {...props} />;
}
