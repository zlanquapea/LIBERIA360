'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  createBusinessContent,
  deleteBusinessContent,
  getMyBusinessContent,
  submitBusinessContent,
  updateBusinessContent,
} from '@/lib/business-content-api';
import { HttpError } from '@/lib/http';
import { formatBusinessContentStatus, formatBusinessContentType } from '@/lib/format';
import { PhotoManager } from './PhotoManager';
import type { BusinessContent, BusinessContentType } from '@/lib/types';

const CONTENT_TYPES: BusinessContentType[] = ['offer', 'announcement', 'article', 'travel_tip', 'experience'];

// Same status→tone mapping style as ReviewStatusBanner in
// BusinessClaimSection, scaled down to a compact badge since each content
// item needs one inline rather than a full banner.
const STATUS_TONE: Record<BusinessContent['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  approved: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
  rejected: 'bg-flag-500/10 text-flag-700',
};

function StatusBadge({ status }: { status: BusinessContent['status'] }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}>
      {formatBusinessContentStatus(status)}
    </span>
  );
}

// Owner-facing "Updates" authoring area — offers, announcements, articles,
// travel tips, experiences (task #142). New items start as DRAFT and stay
// invisible on the public listing (see BusinessContentService.create /
// getBusinessContent's approved-only gate) until the owner submits and an
// admin approves them from the moderation queue.
export function BusinessContentManager({ token, businessId }: { token: string; businessId: string }) {
  const [items, setItems] = useState<BusinessContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<BusinessContent | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    getMyBusinessContent(token, businessId)
      .then(setItems)
      .catch((err) => setError(err instanceof HttpError ? err.message : 'Could not load your content.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, businessId]);

  async function handleSubmitForReview(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await submitBusinessContent(token, id);
      setItems((prev) => prev?.map((i) => (i.id === id ? updated : i)) ?? prev);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteBusinessContent(token, id);
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (creating || editingItem) {
    return (
      <BusinessContentForm
        token={token}
        businessId={businessId}
        item={editingItem}
        onSaved={(saved) => {
          setItems((prev) => {
            if (!prev) return [saved];
            const exists = prev.some((i) => i.id === saved.id);
            return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev];
          });
          setCreating(false);
          setEditingItem(null);
        }}
        onCancel={() => {
          setCreating(false);
          setEditingItem(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Updates (offers, announcements &amp; more)</p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700"
        >
          + New
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}

      {items === null && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {items !== null && items.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No updates yet. Post an offer, announcement, article, travel tip, or experience to share with visitors.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatBusinessContentType(item.type)}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              {item.status === 'rejected' && item.rejectionReason && (
                <p className="text-xs italic text-flag-700">Reviewer note: {item.rejectionReason}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingItem(item)}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Edit
                </button>
                {(item.status === 'draft' || item.status === 'rejected') && (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleSubmitForReview(item.id)}
                    className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-60"
                  >
                    Submit for review
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => handleDelete(item.id)}
                  className="text-xs font-medium text-flag-700 hover:underline disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Shared by both "create" and "edit" — editing a REJECTED item auto-
// resubmits it on save (BusinessContentService.update's doc comment), same
// pattern as BusinessEditForm above.
function BusinessContentForm({
  token,
  businessId,
  item,
  onSaved,
  onCancel,
}: {
  token: string;
  businessId: string;
  item: BusinessContent | null;
  onSaved: (item: BusinessContent) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<BusinessContentType>(item?.type ?? 'offer');
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [externalLink, setExternalLink] = useState(item?.externalLink ?? '');
  const [validFrom, setValidFrom] = useState(item?.validFrom ? item.validFrom.slice(0, 10) : '');
  const [validUntil, setValidUntil] = useState(item?.validUntil ? item.validUntil.slice(0, 10) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved = item
        ? await updateBusinessContent(token, item.id, {
            title,
            body,
            images,
            externalLink: externalLink.trim() || undefined,
            validFrom: validFrom || undefined,
            validUntil: validUntil || undefined,
          })
        : await createBusinessContent(token, {
            businessId,
            type,
            title,
            body,
            images,
            externalLink: externalLink.trim() || undefined,
            validFrom: validFrom || undefined,
            validUntil: validUntil || undefined,
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item ? 'Edit update' : 'New update'}</p>
      {item?.status === 'rejected' && (
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-xs text-flag-700">Saving resubmits this for admin review.</p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Type
        <select
          value={type}
          disabled={!!item}
          onChange={(e) => setType(e.target.value as BusinessContentType)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatBusinessContentType(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Title
        <input
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Details
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Link (optional)
        <input
          type="url"
          placeholder="https://"
          maxLength={500}
          value={externalLink}
          onChange={(e) => setExternalLink(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Valid from (optional)
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Valid until (optional)
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
