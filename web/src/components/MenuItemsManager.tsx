'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createMenuItem, deleteMenuItem, getMenuItems, updateMenuItem } from '@/lib/menu-items-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { SingleImageUploader } from './SingleImageUploader';
import { ConfirmDialog } from './ConfirmDialog';
import type { MenuItem, UpdateMenuItemInput } from '@/lib/types';

const EMPTY_FORM = { name: '', description: '', price: '', category: '', image: null as string | null };

// Owner-facing Menu authoring area (Restaurant/food-and-dining businesses)
// — same immediate-per-item-mutation shape as CreatorOfferingsManager
// (each item is its own row on the backend, no batch save), plus a photo
// per item since a menu item is picture + name + price. Unlike
// BusinessContentManager, no draft/submit step: a menu item never goes
// through admin review (see MenuItem's doc comment on the backend), so
// every edit here is live on the public menu immediately. Self-fetches on
// mount (no embedded relation on Business, same reasoning as
// BusinessContentManager) rather than receiving items as a prop.
export function MenuItemsManager({ token, businessId }: { token: string; businessId: string }) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [pendingRemove, setPendingRemove] = useState<MenuItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    getMenuItems(businessId)
      .then(setItems)
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-menu-items', businessId } })));
  }, [businessId]);

  async function patchItem(item: MenuItem, patch: UpdateMenuItemInput) {
    try {
      const updated = await updateMenuItem(token, item.id, patch);
      setItems((prev) => prev?.map((i) => (i.id === item.id ? updated : i)) ?? prev);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'update-menu-item', itemId: item.id } }));
    }
  }

  function handleTextBlur(item: MenuItem, field: 'name' | 'description' | 'category', value: string) {
    const normalized = value.trim();
    if (normalized === (item[field] ?? '')) return;
    patchItem(item, { [field]: normalized || undefined });
  }

  function handlePriceBlur(item: MenuItem, value: string) {
    const price = Number(value);
    if (!value || Number.isNaN(price) || price === item.price) return;
    patchItem(item, { price });
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setError(null);
    setSubmitting(true);
    try {
      const item = await createMenuItem(token, {
        businessId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        category: form.category.trim() || undefined,
        image: form.image ?? undefined,
      });
      setItems((prev) => [...(prev ?? []), item]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'add-menu-item', businessId } }));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await deleteMenuItem(token, pendingRemove.id);
      setItems((prev) => prev?.filter((i) => i.id !== pendingRemove.id) ?? prev);
      setPendingRemove(null);
    } catch (err) {
      if (isNotFoundError(err)) {
        setItems((prev) => prev?.filter((i) => i.id !== pendingRemove.id) ?? prev);
        setPendingRemove(null);
      } else {
        setRemoveError(getFriendlyErrorMessage(err, { context: { action: 'remove-menu-item', itemId: pendingRemove.id } }));
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Menu (picture, item &amp; price)</p>

      {items === null && !error && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <SingleImageUploader
                token={token}
                value={item.image}
                onChange={(url) => patchItem(item, { image: url ?? undefined })}
                label="Photo"
                className="h-16 w-16 shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <input
                    defaultValue={item.name}
                    onBlur={(e) => handleTextBlur(item, 'name', e.target.value)}
                    maxLength={150}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50 outline-none hover:border-slate-300 focus:border-brand-500 dark:hover:border-slate-700"
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      step="0.01"
                      defaultValue={item.price}
                      onBlur={(e) => handlePriceBlur(item, e.target.value)}
                      className="w-20 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-50 outline-none hover:border-slate-300 focus:border-brand-500 dark:hover:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setPendingRemove(item)}
                      aria-label="Remove menu item"
                      className="text-xs text-flag-700 dark:text-flag-300 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <textarea
                  defaultValue={item.description ?? ''}
                  onBlur={(e) => handleTextBlur(item, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  maxLength={2000}
                  className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-600 dark:text-slate-300 outline-none hover:border-slate-300 focus:border-brand-500 dark:hover:border-slate-700"
                />
                <div className="flex flex-wrap items-center gap-3 px-1">
                  <input
                    defaultValue={item.category ?? ''}
                    onBlur={(e) => handleTextBlur(item, 'category', e.target.value)}
                    placeholder="Section (e.g. Mains)"
                    maxLength={60}
                    className="w-40 rounded-md border border-transparent bg-transparent py-0.5 text-xs text-slate-500 outline-none hover:border-slate-300 focus:border-brand-500 dark:text-slate-400 dark:hover:border-slate-700"
                  />
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={item.isAvailable}
                      onChange={(e) => patchItem(item, { isAvailable: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-700"
                    />
                    Available
                  </label>
                  {!item.isAvailable && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Sold out
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No menu items yet. Add a dish or drink below — a photo, the name, and the price.
        </p>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Add a menu item</p>
        <div className="flex gap-3">
          <SingleImageUploader
            token={token}
            value={form.image}
            onChange={(url) => setForm({ ...form, image: url })}
            label="Photo"
            className="h-16 w-16 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                placeholder="Item name (e.g. Jollof Rice)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={150}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
              />
              <input
                placeholder="Price ($)"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <input
              placeholder="Section (optional, e.g. Mains, Drinks)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              maxLength={60}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              maxLength={2000}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !form.name.trim() || !form.price}
          className="self-start rounded-full bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : '+ Add to menu'}
        </button>
      </form>

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      <ConfirmDialog
        open={pendingRemove != null}
        title={pendingRemove ? `Remove "${pendingRemove.name}"?` : 'Remove this menu item?'}
        description="It will no longer show on your public menu."
        confirmLabel="Remove"
        loadingLabel="Removing…"
        isLoading={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => {
          if (removing) return;
          setPendingRemove(null);
          setRemoveError(null);
        }}
      />
    </div>
  );
}
