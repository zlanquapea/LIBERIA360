'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { HttpError } from '@/lib/http';
import { useAuth } from '@/hooks/useAuth';
import { getCategories, getCounties } from '@/lib/api';
import { CountySelect, InterestChips, TravelerTypeSelect } from '@/components/ProfileFields';
import type { Category, County, TravelerType } from '@/lib/types';

// useSearchParams opts this page out of static rendering unless it's
// wrapped in Suspense — same idiom as reset-password/verify-email. The
// params it reads (`invite`, `email`) come from a trip invitation link
// (Section 3: "Invitation → Create Account → Confirm Account → Accept
// Invitation → Join Trip") — signing up this way lands back on the
// invitation already linked, instead of the generic /account redirect.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [homeCountyId, setHomeCountyId] = useState('');
  const [travelerType, setTravelerType] = useState<TravelerType | ''>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
    getCounties().then(setCounties);
  }, []);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        homeCountyId: homeCountyId || undefined,
        travelerType: travelerType || undefined,
        interests: interests.length > 0 ? interests : undefined,
        inviteToken,
      });
      router.push(inviteToken ? `/invite/${inviteToken}` : '/account');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Create an account</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {inviteToken
            ? "You're almost in — create an account to view and accept your trip invitation."
            : 'Save trips, write reviews, and claim your business on LIBERIA360.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input
            type="text"
            required
            maxLength={150}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs font-normal text-slate-400 dark:text-slate-400">At least 8 characters.</span>
        </label>

        <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Which best describes you? <span className="font-normal text-slate-400 dark:text-slate-400">(optional)</span>
            <TravelerTypeSelect value={travelerType} onChange={setTravelerType} />
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-400">Helps us show you (and businesses) more relevant places.</p>
        </div>

        {counties.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              Home county <span className="font-normal text-slate-400 dark:text-slate-400">(optional)</span>
              <CountySelect value={homeCountyId} onChange={setHomeCountyId} counties={counties} />
            </label>
          </div>
        )}

        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              What are you into? <span className="font-normal text-slate-400 dark:text-slate-400">(optional)</span>
            </p>
            <InterestChips categories={categories} selected={interests} onToggle={toggleInterest} />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-400">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          href={inviteToken ? `/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}` : '/login'}
          className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
