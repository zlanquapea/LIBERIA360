'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MENU_KIND_EMOJI, MENU_KIND_LABELS, MENU_TAGS, MENU_TAG_LABELS } from '@/lib/menu';
import {
  MAX_CHOICES_PER_GROUP,
  MAX_OPTION_GROUPS,
  draftError,
  draftKey,
  presetGroup,
  type DraftGroup,
  type MenuItemDraft,
  type OptionGroupPreset,
} from '@/lib/menu-editor';
import type { MenuCurrency, MenuItemKind } from '@/lib/types';
import { SingleImageUploader } from '@/components/SingleImageUploader';
import { MenuSheet } from './MenuSheet';

const KINDS: MenuItemKind[] = ['food', 'drink', 'dessert'];
const CURRENCY_SYMBOL: Record<MenuCurrency, string> = { USD: 'US$', LRD: 'L$' };

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-900/40';
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200';

function OptionGroupEditor({
  group,
  index,
  currency,
  onChange,
  onRemove,
}: {
  group: DraftGroup;
  index: number;
  currency: MenuCurrency;
  onChange: (group: DraftGroup) => void;
  onRemove: () => void;
}) {
  const multi = group.maxSelections > 1;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-start gap-2">
        <label className="flex-1">
          <span className="sr-only">Option group {index + 1} name</span>
          <input
            value={group.name}
            onChange={(e) => onChange({ ...group, name: e.target.value })}
            placeholder="Group name (e.g. Size, Add-ons)"
            maxLength={80}
            className={`${inputClass} font-semibold`}
          />
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove option group ${group.name || index + 1}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-flag-500/10 hover:text-flag-700"
        >
          <TrashIcon aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700 dark:text-slate-200">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={group.required}
            onChange={(e) => onChange({ ...group, required: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
          />
          Customer must choose
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={multi}
            onChange={(e) =>
              onChange({ ...group, maxSelections: e.target.checked ? Math.max(2, group.choices.length) : 1 })
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
          />
          Allow several
        </label>
        {multi && (
          <label className="flex items-center gap-2">
            Up to
            <input
              type="number"
              min={2}
              max={Math.max(2, group.choices.length)}
              value={group.maxSelections}
              onChange={(e) => onChange({ ...group, maxSelections: Math.max(2, Number(e.target.value) || 2) })}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {group.choices.map((choice, ci) => (
          <li key={choice.key} className="flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">Choice {ci + 1}</span>
              <input
                value={choice.name}
                onChange={(e) =>
                  onChange({
                    ...group,
                    choices: group.choices.map((c) => (c.key === choice.key ? { ...c, name: e.target.value } : c)),
                  })
                }
                placeholder={`Choice ${ci + 1}`}
                maxLength={80}
                className={inputClass}
              />
            </label>
            <label className="flex w-32 shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-400">+{CURRENCY_SYMBOL[currency]}</span>
              <span className="sr-only">Extra price for choice {ci + 1}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={choice.priceDelta}
                onChange={(e) =>
                  onChange({
                    ...group,
                    choices: group.choices.map((c) => (c.key === choice.key ? { ...c, priceDelta: e.target.value } : c)),
                  })
                }
                placeholder="0"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </label>
            <button
              type="button"
              disabled={group.choices.length === 1}
              onClick={() => onChange({ ...group, choices: group.choices.filter((c) => c.key !== choice.key) })}
              aria-label={`Remove choice ${choice.name || ci + 1}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-flag-700 disabled:opacity-30"
            >
              <TrashIcon aria-hidden className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {group.choices.length < MAX_CHOICES_PER_GROUP && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...group, choices: [...group.choices, { key: draftKey(), name: '', priceDelta: '' }] })
          }
          className="inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          <PlusIcon aria-hidden className="h-4 w-4" /> Add choice
        </button>
      )}
    </div>
  );
}

export function MenuItemEditor({
  open,
  title,
  initial,
  token,
  currency,
  sections,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: MenuItemDraft;
  token: string;
  currency: MenuCurrency;
  // Existing section names, offered as suggestions so "Mains" and "mains"
  // don't end up as two separate sections.
  sections: string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: MenuItemDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setShowErrors(false);
  }, [open, initial]);

  const problem = draftError(draft);
  const set = <K extends keyof MenuItemDraft>(key: K, value: MenuItemDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function addGroup(preset: OptionGroupPreset) {
    setDraft((d) => ({ ...d, groups: [...d.groups, presetGroup(preset)] }));
  }

  function submit() {
    if (problem) {
      setShowErrors(true);
      return;
    }
    onSave(draft);
  }

  const presets: { id: OptionGroupPreset; label: string }[] =
    draft.kind === 'drink'
      ? [
          { id: 'size', label: 'Size' },
          { id: 'mixer', label: 'Mixer' },
          { id: 'blank', label: 'Custom' },
        ]
      : [
          { id: 'size', label: 'Size' },
          { id: 'addons', label: 'Add-ons' },
          { id: 'blank', label: 'Custom' },
        ];

  return (
    <MenuSheet
      open={open}
      onClose={onClose}
      label={title}
      footer={
        <div className="flex flex-col gap-2">
          {(error || (showErrors && problem)) && (
            <p role="alert" className="text-center text-sm font-semibold text-flag-700 dark:text-flag-300">
              {error ?? problem}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="min-h-12 flex-1 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save item'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
        <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{title}</h2>

        <div role="radiogroup" aria-label="Item type" className="grid grid-cols-3 gap-2">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={draft.kind === kind}
              onClick={() => set('kind', kind)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-semibold transition ${
                draft.kind === kind
                  ? 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-950/50 dark:text-brand-100'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <span aria-hidden className="text-2xl">
                {MENU_KIND_EMOJI[kind]}
              </span>
              {MENU_KIND_LABELS[kind]}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <SingleImageUploader
            token={token}
            value={draft.image}
            onChange={(url) => set('image', url)}
            label="Photo"
            aspect="1:1"
            className="h-24 w-24 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <label className={labelClass}>
              Name
              <input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={150}
                placeholder={draft.kind === 'drink' ? 'e.g. Club Beer' : draft.kind === 'dessert' ? 'e.g. Coconut Pie' : 'e.g. Jollof Rice'}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Price
              <span className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-sm font-semibold text-slate-400">{CURRENCY_SYMBOL[currency]}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set('price', e.target.value)}
                  className="w-full bg-transparent py-2 text-sm font-normal outline-none"
                />
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            <span>
              Section <span className="font-normal text-slate-400">optional</span>
            </span>
            <input
              value={draft.category}
              onChange={(e) => set('category', e.target.value)}
              list="menu-sections"
              maxLength={60}
              placeholder={draft.kind === 'drink' ? 'e.g. Cocktails, Beer' : 'e.g. Mains, Soups'}
              className={inputClass}
            />
            <datalist id="menu-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className={labelClass}>
            <span>
              Portion or size <span className="font-normal text-slate-400">optional</span>
            </span>
            <input
              value={draft.servingSize}
              onChange={(e) => set('servingSize', e.target.value)}
              maxLength={40}
              placeholder={draft.kind === 'drink' ? 'e.g. 330ml bottle' : 'e.g. Serves 2'}
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          <span>
            Description <span className="font-normal text-slate-400">optional</span>
          </span>
          <textarea
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What makes it good? Main ingredients, how it's cooked…"
            className={`${inputClass} font-normal`}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Labels</legend>
          <div className="flex flex-wrap gap-2">
            {MENU_TAGS.map((tag) => {
              const on = draft.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('tags', on ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag])}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? 'border-brand-600 bg-brand-700 text-white'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {MENU_TAG_LABELS[tag]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.containsAlcohol}
              onChange={(e) => set('containsAlcohol', e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
            />
            <span className="text-slate-700 dark:text-slate-200">
              <strong>Contains alcohol</strong>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Shows an 18+ label, and customers confirm their age before ordering.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.isAvailable}
              onChange={(e) => set('isAvailable', e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
            />
            <span className="text-slate-700 dark:text-slate-200">
              <strong>Available to order</strong>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Untick to show it as sold out without removing it.
              </span>
            </span>
          </label>
        </div>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Options</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sizes, sides, add-ons or mixers. Extra prices are added to the item&apos;s price.
            </p>
          </div>
          {draft.groups.map((group, i) => (
            <OptionGroupEditor
              key={group.key}
              group={group}
              index={i}
              currency={currency}
              onChange={(next) => set('groups', draft.groups.map((g) => (g.key === group.key ? next : g)))}
              onRemove={() => set('groups', draft.groups.filter((g) => g.key !== group.key))}
            />
          ))}
          {draft.groups.length < MAX_OPTION_GROUPS && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Add:</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addGroup(p.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:text-brand-300 dark:hover:bg-brand-950/30"
                >
                  <PlusIcon aria-hidden className="h-3.5 w-3.5" /> {p.label}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </MenuSheet>
  );
}
