'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
import { SingleImageUploader } from '@/components/SingleImageUploader';
import { SafeImage } from '@/components/SafeImage';
import { useAuth } from '@/hooks/useAuth';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import {
  deletePharmacyProduct,
  getMyPharmacyProducts,
  getPharmacyCategoriesClient,
  savePharmacyProduct,
  type PharmacyProduct,
  type PharmacyProductInput,
} from '@/lib/pharmacy-api';

const EMPTY_PRODUCT_FORM: PharmacyProductInput = {
  name: '',
  categoryId: '',
  price: 0,
  stockQuantity: 0,
  prescriptionRequired: false,
  isVisible: true,
};

// A product with no photo yet — most customers recognize a medication by
// its box/blister pack on sight, so this is deliberately a placeholder
// that invites adding one, not just a generic "no image" icon.
function ProductImagePlaceholder({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-brand-50 text-2xl dark:from-emerald-950/40 dark:to-brand-950/40 ${className}`}
    >
      💊
    </div>
  );
}

function ProductForm({
  token,
  pharmacyId,
  categories,
  editing,
  onDone,
  onCancel,
}: {
  token: string;
  pharmacyId: string;
  categories: Array<{ id: string; name: string }>;
  editing: PharmacyProduct | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PharmacyProductInput>(
    editing
      ? {
          name: editing.name,
          categoryId: editing.categoryId,
          imageUrl: editing.imageUrl ?? undefined,
          price: Number(editing.price),
          stockQuantity: editing.inventory?.quantity ?? 0,
          // Captured once, at load time, so the save can be applied as a
          // delta off whatever is actually stored by then — not resent as
          // this fixed value on every re-render.
          previousStockQuantity: editing.inventory?.quantity ?? 0,
          prescriptionRequired: editing.prescriptionRequired,
          isVisible: editing.isVisible,
        }
      : EMPTY_PRODUCT_FORM,
  );
  const [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await savePharmacyProduct(pharmacyId, editing?.id, form);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40 sm:flex-row"
    >
      <div className="shrink-0">
        {/* Most customers recognize a medication by its pack/box on sight —
            this is the one field the original form was missing entirely. */}
        <SingleImageUploader
          token={token}
          value={form.imageUrl ?? null}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url ?? undefined }))}
          label="Product photo"
          className="h-28 w-28"
        />
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Product name</span>
          <input
            required
            className="input mt-1 w-full"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Category</span>
          <select
            required
            className="input mt-1 w-full"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Price (L$)</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="input mt-1 w-full"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
          />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Stock quantity</span>
          <input
            required
            type="number"
            min={0}
            className="input mt-1 w-full"
            value={form.stockQuantity}
            onChange={(e) => setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))}
          />
        </label>
        <div className="flex flex-col justify-center gap-2 sm:col-span-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.prescriptionRequired}
              onChange={(e) => setForm((f) => ({ ...f, prescriptionRequired: e.target.checked }))}
            />
            Prescription required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVisible ?? true}
              onChange={(e) => setForm((f) => ({ ...f, isVisible: e.target.checked }))}
            />
            Visible in storefront
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary min-h-10" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
          </button>
          <button type="button" className="btn-secondary min-h-10" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="error-state sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

export default function PharmacyProductsPage() {
  const { pharmacy } = usePharmacyDashboard();
  const { token } = useAuth();
  const pharmacyId = pharmacy.id;
  const [products, setProducts] = useState<PharmacyProduct[] | null>(null),
    [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]),
    [creating, setCreating] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [error, setError] = useState('');
  const load = useCallback(() => {
    Promise.all([getMyPharmacyProducts(pharmacyId), getPharmacyCategoriesClient()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [pharmacyId]);
  useEffect(load, [load]);
  async function remove(product: PharmacyProduct) {
    if (!window.confirm(`Remove "${product.name}" from your catalog?`)) return;
    try {
      await deletePharmacyProduct(pharmacyId, product.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove product.');
    }
  }
  // The dashboard shell already requires a signed-in staff member to reach
  // this page — token is only ever transiently null during the first
  // client render, before useAuth() has synced from storage.
  if (!token) return null;
  const editingProduct = products?.find((p) => p.id === editingId) ?? null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Products</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your catalog — what customers see in the storefront.
          </p>
        </div>
        {!creating && (
          <button
            className="btn-secondary min-h-9"
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
          >
            + Add product
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error-state mt-2">
          {error}
        </p>
      )}
      {creating && (
        <ProductForm
          token={token}
          pharmacyId={pharmacyId}
          categories={categories}
          editing={null}
          onDone={() => {
            setCreating(false);
            load();
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {products === null && !error && <p className="mt-2">Loading products…</p>}
      {products?.length === 0 && (
        <p className="empty-state mt-2">
          No products yet — add your first one above, with a photo so customers can recognize it.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {products?.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {editingProduct?.id === p.id ? (
              <ProductForm
                token={token}
                pharmacyId={pharmacyId}
                categories={categories}
                editing={p}
                onDone={() => {
                  setEditingId(null);
                  load();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {p.imageUrl ? (
                  <SafeImage
                    src={resolveImageUrl(p.imageUrl)}
                    thumbSrc={resolveThumbUrl(p.imageUrl)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    fallback={<ProductImagePlaceholder className="h-16 w-16 shrink-0" />}
                  />
                ) : (
                  <ProductImagePlaceholder className="h-16 w-16 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                    {p.name}
                    {p.category && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
                        {p.category.name}
                      </span>
                    )}
                    {!p.isVisible && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">
                        Hidden
                      </span>
                    )}
                    {p.prescriptionRequired && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        Prescription
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    L${Number(p.price).toFixed(2)} ·{' '}
                    {p.inventory?.quantity ? `${p.inventory.quantity} in stock` : 'Out of stock'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary min-h-9" onClick={() => setEditingId(p.id)}>
                    Edit
                  </button>
                  <button className="btn-secondary min-h-9 text-red-700" onClick={() => remove(p)}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
