'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getCategories, getCounties } from '@/lib/api';
import type { Category, County } from '@/lib/types';
import { CategoriesTab } from './CategoriesTab';
import { PlacesTab } from './PlacesTab';
import { EventsTab } from './EventsTab';
import { CountiesTab } from './CountiesTab';
import { CreatorsTab } from './CreatorsTab';
import { BusinessesTab } from './BusinessesTab';
import { AdvertisementsTab } from './AdvertisementsTab';
import { CarListingsTab } from './CarListingsTab';

type Tab = 'categories' | 'places' | 'events' | 'counties' | 'creators' | 'businesses' | 'advertisements' | 'car-listings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'places', label: 'Places' },
  { id: 'events', label: 'Events' },
  { id: 'counties', label: 'Counties' },
  { id: 'creators', label: 'Creators' },
  { id: 'businesses', label: 'Businesses' },
  { id: 'advertisements', label: 'Advertisements' },
  { id: 'car-listings', label: 'Car Rentals' },
];

function isTab(value: string | null): value is Tab {
  return value !== null && TABS.some((t) => t.id === value);
}

// Admin content management (Tech Spec §8) — one tab per entity, each
// list-first: a table of what exists, a "+ New" button, click a row to
// edit. Not a single page of stacked forms — a real admin panel, where
// "manage X" means see all of X, not hunt for a dropdown.
export default function AdminContentPage() {
  const { token, user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const searchParams = useSearchParams();
  // Reads the ?tab= the sidebar's "Categories" deep-link sets; a plain
  // useState default wouldn't pick this up since the search param is
  // only known once the router hands it to us, one tick after mount.
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [counties, setCounties] = useState<County[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
    getCounties().then(setCounties);
  }, []);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Content Management</h1>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-brand-700 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <CategoriesTab token={token} categories={categories} isSuperAdmin={isSuperAdmin} onChanged={setCategories} />
      )}
      {tab === 'places' && (
        <PlacesTab token={token} categories={categories} counties={counties} isSuperAdmin={isSuperAdmin} />
      )}
      {tab === 'events' && <EventsTab token={token} counties={counties} />}
      {tab === 'counties' && (
        <CountiesTab token={token} counties={counties} isSuperAdmin={isSuperAdmin} onChanged={setCounties} />
      )}
      {tab === 'creators' && <CreatorsTab token={token} />}
      {tab === 'businesses' && <BusinessesTab token={token} />}
      {tab === 'advertisements' && <AdvertisementsTab token={token} />}
      {tab === 'car-listings' && <CarListingsTab token={token} />}
    </div>
  );
}
