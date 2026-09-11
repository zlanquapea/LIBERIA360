'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
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

function ProductForm({
  pharmacyId,
  categories,
  editing,
  onDone,
  onCancel,
}: {
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
      className="mt-3 grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-2"
    >
      <label>
        Product name
        <input
          required
          className="input mt-1 w-full"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </label>
      <label>
        Category
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
        Price (L$)
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
        Stock quantity
        <input
          required
          type="number"
          min={0}
          className="input mt-1 w-full"
          value={form.stockQuantity}
          onChange={(e) => setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.prescriptionRequired}
          onChange={(e) => setForm((f) => ({ ...f, prescriptionRequired: e.target.checked }))}
        />
        Prescription required
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isVisible ?? true}
          onChange={(e) => setForm((f) => ({ ...f, isVisible: e.target.checked }))}
        />
        Visible in storefront
      </label>
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
    </form>
  );
}

export default function PharmacyProductsPage() {
  const { pharmacy } = usePharmacyDashboard();
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
            Add product
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
      {products?.length === 0 && <p className="empty-state mt-2">No products yet.</p>}
      <ul className="mt-3 space-y-2">
        {products?.map((p) => (
          <li key={p.id} className="rounded-xl border p-3">
            {editingProduct?.id === p.id ? (
              <ProductForm
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {p.name}
                    {!p.isVisible && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">
                        Hidden
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    L${Number(p.price).toFixed(2)} · {p.inventory?.quantity ?? 0} in stock
                    {p.prescriptionRequired && ' · prescription required'}
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
