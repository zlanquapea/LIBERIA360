'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon, FlagIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getAssistantReviewQueue } from '@/lib/admin-api';
import type { AssistantReviewQueue, AssistantReviewRecord } from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';

const typeLabels: Record<AssistantReviewRecord['type'], string> = {
  helpful: 'Helpful',
  not_helpful: 'Not helpful',
  incorrect: 'Incorrect',
  unanswered: 'Unanswered',
};

const typeStyles: Record<AssistantReviewRecord['type'], string> = {
  helpful: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  not_helpful: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  incorrect: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  unanswered: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AssistantReviewPage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<AssistantReviewQueue | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setError(null);
    try {
      setQueue(await getAssistantReviewQueue(token));
    } catch {
      setError('Unable to load assistant review data. Please try again.');
    }
  }

  useEffect(() => { void load(); }, [token]);

  const attention = useMemo(() => (queue ? queue.counts.incorrect + queue.counts.unanswered + queue.counts.not_helpful : 0), [queue]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Assistant Reviews"
        description="Use real user feedback to find unanswered questions and improve LIBERIA360 Assistant answers."
        action={
          <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <ArrowPathIcon className="h-4 w-4" aria-hidden /> Refresh
          </button>
        }
      />

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {!queue ? <LoadingState /> : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Assistant review summary">
            {([
              ['Needs attention', attention, ExclamationTriangleIcon, 'text-red-600'],
              ['Unanswered', queue.counts.unanswered, ChatBubbleLeftRightIcon, 'text-violet-600'],
              ['Incorrect', queue.counts.incorrect, FlagIcon, 'text-red-600'],
              ['Not helpful', queue.counts.not_helpful, ExclamationTriangleIcon, 'text-amber-600'],
              ['Helpful', queue.counts.helpful, HandThumbUpIcon, 'text-green-600'],
            ] as const).map(([label, value, Icon, color]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><Icon className={`h-5 w-5 ${color}`} aria-hidden /></div>
                <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Common questions</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Questions appearing most often in the current review sample.</p>
            {queue.topQuestions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No questions logged yet.</p> : <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{queue.topQuestions.map((item) => <li key={item.question} className="flex items-center justify-between gap-4 py-3"><span className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.question}</span><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.count} report{item.count === 1 ? '' : 's'}</span></li>)}</ol>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-lg font-bold text-slate-950 dark:text-white">Review queue</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest feedback and unanswered questions, newest first.</p></div>
            {queue.data.length === 0 ? <div className="p-5"><EmptyState title="No assistant feedback yet" description="New reports and unanswered questions will appear here." /></div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{queue.data.map((record) => <article key={record.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${typeStyles[record.type]}`}>{typeLabels[record.type]}</span><time className="text-xs text-slate-500 dark:text-slate-400" dateTime={record.createdAt}>{formatDate(record.createdAt)}</time></div><p className="mt-3 text-sm font-bold text-slate-950 dark:text-white">{record.question}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{record.answer}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">Source: {record.source === 'knowledge' ? 'LIBERIA360 Guide' : 'AI assistant'}</span>{record.currentPath && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">Page: {record.currentPath}</span>}</div></article>)}</div>}
          </section>
        </>
      )}
    </div>
  );
}
