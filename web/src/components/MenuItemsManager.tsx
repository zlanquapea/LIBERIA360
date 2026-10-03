'use client';

import { useEffect, useMemo, useState } from 'react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItems,
  getMenuSettings,
  updateMenuItem,
  updateMenuSettings,
} from '@/lib/menu-items-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { formatMoney } from '@/lib/currency';
import { resolveThumbUrl } from '@/lib/images';
import { MENU_KIND_EMOJI, MENU_KIND_LABELS, groupBySection, menuKindsInOrder } from '@/lib/menu';
import { draftFromItem, draftToInput, emptyDraft, type MenuItemDraft } from '@/lib/menu-editor';
import type { BusinessType, MenuCurrency, MenuItem, MenuItemKind } from '@/lib/types';
import { SafeImage } from './SafeImage';
import { ConfirmDialog } from './ConfirmDialog';
import { BrandLoader } from './BrandLoader';
import { MenuTagBadges } from './menu/MenuItemCard';
import { MenuItemEditor } from './menu/MenuItemEditor';

const CURRENCIES: { id: MenuCurrency; label: string }[] = [
  { id: 'USD', label: 'US Dollars (US$)' },
  { id: 'LRD', label: 'Liberian Dollars (L$)' },
];

type EditorState = { item: MenuItem | null; draft: MenuItemDraft } | null;

// Owner-facing Menu authoring area for restaurants and bars. Every item is
// its own row on the backend (no batch save) and there's no draft/review
// step — a MenuItem never goes through admin review (see its doc comment on
// the backend), so a save here is live on the public menu immediately.
// Editing happens in one focused sheet (MenuItemEditor) rather than inline
// fields, since an item now carries options, labels and drink details too.
export function MenuItemsManager({
  token,
  businessId,
  businessType = 'restaurant',
}: {
  token: string;
  businessId: string;
  businessType?: BusinessType;
}) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [currency, setCurrency] = useState<MenuCurrency>('USD');
  const [error, setError] = useState<string | null>(null);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [filter, setFilter] = useState<MenuItemKind | 'all'>('all');

  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingRemove, setPendingRemove] = useState<MenuItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMenuItems(businessId), getMenuSettings(businessId)])
      .then(([loaded, settings]) => {
        setItems(loaded);
        setCurrency(settings.currency);
      })
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-menu-items', businessId } })));
  }, [businessId]);

  const kinds = useMemo(() => menuKindsInOrder(items ?? [], businessType), [items, businessType]);
  const sections = useMemo(
    () => [...new Set((items ?? []).map((i) => i.category).filter((c): c is string => !!c))].sort(),
    [items],
  );
  const visible = useMemo(
    () => (items ?? []).filter((i) => filter === 'all' || i.kind === filter),
    [items, filter],
  );
  const grouped = useMemo(() => groupBySection(visible, 'Other'), [visible]);

  async function changeCurrency(next: MenuCurrency) {
    if (next === currency) return;
    const previous = currency;
    setCurrency(next);
    setCurrencySaving(true);
    setError(null);
    try {
      const saved = await updateMenuSettings(token, businessId, { currency: next });
      setCurrency(saved.currency);
    } catch (err) {
      setCurrency(previous);
      setError(getFriendlyErrorMessage(err, { context: { action: 'update-menu-settings', businessId } }));
    } finally {
      setCurrencySaving(false);
    }
  }

  function openNew() {
    setSaveError(null);
    setEditor({
      item: null,
      draft: emptyDraft(filter !== 'all' ? filter : businessType === 'bar' ? 'drink' : 'food'),
    });
  }

  function openEdit(item: MenuItem) {
    setSaveError(null);
    setEditor({ item, draft: draftFromItem(item) });
  }

  async function save(draft: MenuItemDraft) {
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    const input = draftToInput(draft);
    try {
      if (editor.item) {
        const updated = await updateMenuItem(token, editor.item.id, input);
        setItems((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? prev);
      } else {
        const created = await createMenuItem(token, { ...input, businessId });
        setItems((prev) => [...(prev ?? []), created]);
      }
      setEditor(null);
    } catch (err) {
      setSaveError(getFriendlyErrorMessage(err, { context: { action: 'save-menu-item', businessId } }));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(item: MenuItem) {
    setError(null);
    try {
      const updated = await updateMenuItem(token, item.id, { isAvailable: !item.isAvailable });
      setItems((prev) => prev?.map((i) => (i.id === item.id ? updated : i)) ?? prev);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'update-menu-item', itemId: item.id } }));
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

  const counts = (kind: MenuItemKind) => (items ?? []).filter((i) => i.kind === kind).length;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">Your menu</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Food, drinks and desserts — changes go live straight away.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            disabled={items === null}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-bold text-white shadow-md shadow-brand-700/20 hover:bg-brand-800 disabled:opacity-60"
          >
            <PlusIcon aria-hidden className="h-4 w-4" /> Add item
          </button>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <legend className="sr-only">Menu currency</legend>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Prices on your menu are in</p>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  currency === c.id
                    ? 'border-brand-600 bg-white text-brand-800 shadow-sm dark:border-brand-400 dark:bg-slate-900 dark:text-brand-100'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="menu-currency"
                  value={c.id}
                  checked={currency === c.id}
                  disabled={currencySaving || items === null}
                  onChange={() => changeCurrency(c.id)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Customers also see an estimate in the other currency at today&apos;s rate. Switching doesn&apos;t convert
            prices you&apos;ve already entered, so update them to match.
          </p>
        </fieldset>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-flag-500/10 p-3 text-sm font-medium text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      {items === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <BrandLoader size="sm" />
          Loading…
        </div>
      )}

      {items !== null && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <span aria-hidden className="text-4xl">
            {businessType === 'bar' ? '🍹' : '🍲'}
          </span>
          <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
            Nothing on your menu yet. Add your first {businessType === 'bar' ? 'drink' : 'dish'} with a photo, name and
            price, and customers can start ordering.
          </p>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800"
          >
            <PlusIcon aria-hidden className="h-4 w-4" /> Add your first item
          </button>
        </div>
      )}

      {items !== null && items.length > 0 && (
        <>
          <div role="tablist" aria-label="Filter menu" className="flex gap-2 overflow-x-auto pb-1">
            {(['all', ...kinds] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === k
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {k === 'all' ? `All · ${items.length}` : `${MENU_KIND_EMOJI[k]} ${MENU_KIND_LABELS[k]} · ${counts(k)}`}
              </button>
            ))}
          </div>

          {grouped.map(({ section, items: sectionItems }) => (
            <section key={section} className="flex flex-col gap-2">
              <h3 className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {section}
              </h3>
              <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {sectionItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <SafeImage
                      src={item.image ? resolveThumbUrl(item.image) : null}
                      alt=""
                      className={`h-16 w-16 shrink-0 rounded-2xl object-cover ${item.isAvailable ? '' : 'grayscale'}`}
                      fallback={
                        <div
                          aria-hidden
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-gold-100 text-2xl dark:from-brand-950 dark:to-slate-800"
                        >
                          {MENU_KIND_EMOJI[item.kind]}
                        </div>
                      }
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <MenuTagBadges item={item} />
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(item.price, currency)}</span>
                        {item.servingSize && ` · ${item.servingSize}`}
                        {item.optionGroups.length > 0 &&
                          ` · ${item.optionGroups.length} option group${item.optionGroups.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.isAvailable}
                        aria-label={`${item.name} available to order`}
                        onClick={() => toggleAvailable(item)}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        <span
                          className={`relative h-6 w-10 rounded-full transition ${
                            item.isAvailable ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                              item.isAvailable ? 'start-[1.125rem]' : 'start-0.5'
                            }`}
                          />
                        </span>
                        <span className="hidden sm:inline">{item.isAvailable ? 'Available' : 'Sold out'}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800"
                        >
                          <PencilSquareIcon aria-hidden className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemove(item)}
                          aria-label={`Remove ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-flag-500/10 hover:text-flag-700"
                        >
                          <TrashIcon aria-hidden className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <MenuItemEditor
        open={editor !== null}
        title={editor?.item ? `Edit ${editor.item.name}` : 'Add a menu item'}
        initial={editor?.draft ?? INITIAL_DRAFT}
        token={token}
        currency={currency}
        sections={sections}
        saving={saving}
        error={saveError}
        onClose={() => {
          if (!saving) setEditor(null);
        }}
        onSave={save}
      />

      <ConfirmDialog
        open={pendingRemove != null}
        title={pendingRemove ? `Remove "${pendingRemove.name}"?` : 'Remove this menu item?'}
        description="It will no longer show on your public menu. To hide it for a while instead, mark it sold out."
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

// Stable placeholder while the editor is closed, so its reset effect
// doesn't re-fire on every parent render.
const INITIAL_DRAFT = emptyDraft();
