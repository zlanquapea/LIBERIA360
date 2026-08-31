'use client';

import dynamic from 'next/dynamic';

const EventMiniMapClient = dynamic(() => import('./EventMiniMapClient').then((mod) => mod.EventMiniMapClient), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400">Map…</div>,
});

export function EventMiniMapLoader(props: { latitude: number; longitude: number }) {
  return <EventMiniMapClient {...props} />;
}
