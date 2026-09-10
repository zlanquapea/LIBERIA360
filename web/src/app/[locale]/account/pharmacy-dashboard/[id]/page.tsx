"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import {
  assignPharmacyStaff,
  deletePharmacyProduct,
  getMyPharmacyProducts,
  getPharmacyCategories,
  getPharmacyDashboardOrders,
  getPharmacyStats,
  reviewPharmacyPrescription,
  savePharmacyProduct,
  savePharmacyProfile,
  transitionPharmacyOrder,
  type Pharmacy,
  type PharmacyOrder,
  type PharmacyProduct,
  type PharmacyProductInput,
  type PharmacyStats,
} from "@/lib/pharmacy-api";

const ORDER_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
// Mirrors PharmaciesService's own NEXT[] transition map (pharmacies.service.ts)
// so the buttons shown here only ever offer a move the API will actually
// accept — the server re-validates every one regardless, this just avoids
// a round trip that was always going to 409.
const NEXT_STATUSES: Record<string, string[]> = {
  pending: ["accepted", "cancelled"],
  under_review: ["cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "out_for_delivery"],
  ready_for_pickup: ["completed"],
  out_for_delivery: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};
// "preparing" offers both dispatch options above, but only one is ever
// valid for a given order — the API's own NEXT[] map (and its 409) doesn't
// distinguish by fulfillmentMethod either, it just rejects whichever one
// doesn't match, so filter it out here rather than showing a button that's
// guaranteed to fail.
function nextStatusesFor(order: PharmacyOrder): string[] {
  return (NEXT_STATUSES[order.status] ?? []).filter((next) => {
    if (next === "ready_for_pickup") return order.fulfillmentMethod === "pickup";
    if (next === "out_for_delivery") return order.fulfillmentMethod === "delivery";
    return true;
  });
}

function ProfileForm({
  pharmacy,
  onSaved,
}: {
  pharmacy: Pharmacy;
  onSaved: (p: Pharmacy) => void;
}) {
  const [form, setForm] = useState({
    name: pharmacy.name,
    address: pharmacy.address,
    location: pharmacy.location,
    telephone: pharmacy.telephone,
    logoUrl: pharmacy.logoUrl ?? "",
    coverUrl: pharmacy.coverUrl ?? "",
    latitude: pharmacy.latitude != null ? String(pharmacy.latitude) : "",
    longitude: pharmacy.longitude != null ? String(pharmacy.longitude) : "",
    pickupEnabled: pharmacy.pickupEnabled,
    deliveryEnabled: pharmacy.deliveryEnabled,
    deliveryFee: String(pharmacy.deliveryFee),
    // Only present when getMyPharmacies() actually selected it — an
    // application submitted without one (the empty-state ApplicationForm
    // makes it optional) would otherwise never be correctable, since
    // admin approval refuses a pharmacy with none on file.
    licenceNumber: pharmacy.licenceNumber ?? "",
  });
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await savePharmacyProfile(pharmacy.id, {
        name: form.name,
        address: form.address,
        location: form.location,
        telephone: form.telephone,
        logoUrl: form.logoUrl || undefined,
        coverUrl: form.coverUrl || undefined,
        latitude: form.latitude === "" ? undefined : Number(form.latitude),
        longitude: form.longitude === "" ? undefined : Number(form.longitude),
        pickupEnabled: form.pickupEnabled,
        deliveryEnabled: form.deliveryEnabled,
        deliveryFee: Number(form.deliveryFee),
        licenceNumber: form.licenceNumber || undefined,
      });
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label>
        Name
        <input
          required
          className="input mt-1 w-full"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </label>
      <label>
        Telephone
        <input
          required
          className="input mt-1 w-full"
          value={form.telephone}
          onChange={(e) =>
            setForm((f) => ({ ...f, telephone: e.target.value }))
          }
        />
      </label>
      <label className="sm:col-span-2">
        Address
        <input
          required
          className="input mt-1 w-full"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </label>
      <label>
        Location / city
        <input
          required
          className="input mt-1 w-full"
          value={form.location}
          onChange={(e) =>
            setForm((f) => ({ ...f, location: e.target.value }))
          }
        />
      </label>
      <label>
        Delivery fee (L$)
        <input
          required
          type="number"
          min={0}
          step="0.01"
          className="input mt-1 w-full"
          value={form.deliveryFee}
          onChange={(e) =>
            setForm((f) => ({ ...f, deliveryFee: e.target.value }))
          }
        />
      </label>
      <label>
        Licence number
        <input
          className="input mt-1 w-full"
          value={form.licenceNumber}
          onChange={(e) =>
            setForm((f) => ({ ...f, licenceNumber: e.target.value }))
          }
        />
      </label>
      <label>
        Logo URL
        <input
          className="input mt-1 w-full"
          value={form.logoUrl}
          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
        />
      </label>
      <label>
        Cover image URL
        <input
          className="input mt-1 w-full"
          value={form.coverUrl}
          onChange={(e) =>
            setForm((f) => ({ ...f, coverUrl: e.target.value }))
          }
        />
      </label>
      <label>
        Latitude
        <input
          type="number"
          step="any"
          placeholder="e.g. 6.3156"
          className="input mt-1 w-full"
          value={form.latitude}
          onChange={(e) =>
            setForm((f) => ({ ...f, latitude: e.target.value }))
          }
        />
      </label>
      <label>
        Longitude
        <input
          type="number"
          step="any"
          placeholder="e.g. -10.8074"
          className="input mt-1 w-full"
          value={form.longitude}
          onChange={(e) =>
            setForm((f) => ({ ...f, longitude: e.target.value }))
          }
        />
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Coordinates place this pharmacy on the marketplace map — without
        them it stays visible in list view only.
      </p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.pickupEnabled}
          onChange={(e) =>
            setForm((f) => ({ ...f, pickupEnabled: e.target.checked }))
          }
        />
        Pickup enabled
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.deliveryEnabled}
          onChange={(e) =>
            setForm((f) => ({ ...f, deliveryEnabled: e.target.checked }))
          }
        />
        Delivery enabled
      </label>
      <button
        className="btn-primary min-h-11 sm:col-span-2"
        disabled={saving}
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
      {saved && (
        <p role="status" className="text-sm text-emerald-700 sm:col-span-2">
          Profile updated.
        </p>
      )}
      {error && (
        <p role="alert" className="error-state sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}

function StaffForm({ pharmacyId }: { pharmacyId: string }) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<"manager" | "pharmacist" | "employee">(
      "employee",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [added, setAdded] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setAdded(false);
    try {
      await assignPharmacyStaff(pharmacyId, { email, role });
      setEmail("");
      setAdded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add staff member.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex-1">
        Colleague&apos;s email
        <input
          required
          type="email"
          className="input mt-1 w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Role
        <select
          className="input mt-1"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="manager">Manager</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="employee">Employee</option>
        </select>
      </label>
      <button className="btn-secondary min-h-11" disabled={busy}>
        {busy ? "Adding…" : "Add staff"}
      </button>
      {added && (
        <p role="status" className="w-full text-sm text-emerald-700">
          Staff member added.
        </p>
      )}
      {error && (
        <p role="alert" className="error-state w-full">
          {error}
        </p>
      )}
    </form>
  );
}

const EMPTY_PRODUCT_FORM: PharmacyProductInput = {
  name: "",
  categoryId: "",
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
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePharmacyProduct(pharmacyId, editing?.id, form);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save product.");
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
          onChange={(e) =>
            setForm((f) => ({ ...f, categoryId: e.target.value }))
          }
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
          onChange={(e) =>
            setForm((f) => ({ ...f, price: Number(e.target.value) }))
          }
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
          onChange={(e) =>
            setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))
          }
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.prescriptionRequired}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              prescriptionRequired: e.target.checked,
            }))
          }
        />
        Prescription required
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isVisible ?? true}
          onChange={(e) =>
            setForm((f) => ({ ...f, isVisible: e.target.checked }))
          }
        />
        Visible in storefront
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary min-h-10" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
        </button>
        <button
          type="button"
          className="btn-secondary min-h-10"
          onClick={onCancel}
        >
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

function ProductsSection({ pharmacyId }: { pharmacyId: string }) {
  const [products, setProducts] = useState<PharmacyProduct[] | null>(null),
    [categories, setCategories] = useState<
      Array<{ id: string; name: string }>
    >([]),
    [creating, setCreating] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [error, setError] = useState("");
  const load = useCallback(() => {
    Promise.all([
      getMyPharmacyProducts(pharmacyId),
      getPharmacyCategories(),
    ])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [pharmacyId]);
  useEffect(load, [load]);
  async function remove(product: PharmacyProduct) {
    if (!window.confirm(`Remove "${product.name}" from your catalog?`))
      return;
    try {
      await deletePharmacyProduct(pharmacyId, product.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove product.");
    }
  }
  const editingProduct = products?.find((p) => p.id === editingId) ?? null;
  return (
    <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Products</h2>
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
      {products?.length === 0 && (
        <p className="empty-state mt-2">No products yet.</p>
      )}
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
                    L${Number(p.price).toFixed(2)} ·{" "}
                    {p.inventory?.quantity ?? 0} in stock
                    {p.prescriptionRequired && " · prescription required"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary min-h-9"
                    onClick={() => setEditingId(p.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-secondary min-h-9 text-red-700"
                    onClick={() => remove(p)}
                  >
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

function ReviewForm({
  pharmacyId,
  prescriptionId,
  prescriptionVersion,
  onDone,
}: {
  pharmacyId: string;
  prescriptionId: string;
  prescriptionVersion: number | null;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(decision: "accepted" | "rejected" | "clarification_requested") {
    if (prescriptionVersion == null) {
      setError("Could not determine the current prescription version — reload the page.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await reviewPharmacyPrescription(pharmacyId, prescriptionId, {
        decision,
        notes: notes.trim() || undefined,
        prescriptionVersion,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record decision.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        Prescription review required
      </p>
      {/* Streams the actual bytes through the cookie-authenticated API
          route (see PharmaciesController#prescriptionFile) — there's no
          public URL for this file, so a plain <img>/href to the storage
          provider is never an option. */}
      <a
        href={`/api/v1/pharmacy-marketplace/prescriptions/${prescriptionId}/file`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-sm font-semibold text-brand-700 underline"
      >
        View uploaded prescription
      </a>
      <label className="mt-2 block text-sm">
        Notes (shown to the customer on a clarification request)
        <textarea
          className="input mt-1 w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => decide("accepted")}
          className="btn-primary min-h-9"
        >
          Accept
        </button>
        <button
          disabled={busy}
          onClick={() => decide("rejected")}
          className="btn-secondary min-h-9 text-red-700"
        >
          Reject
        </button>
        <button
          disabled={busy}
          onClick={() => decide("clarification_requested")}
          className="btn-secondary min-h-9"
        >
          Request clarification
        </button>
      </div>
      {error && (
        <p role="alert" className="error-state mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

function OrdersSection({
  pharmacyId,
  isPharmacist,
}: {
  pharmacyId: string;
  isPharmacist: boolean;
}) {
  const [orders, setOrders] = useState<PharmacyOrder[] | null>(null),
    [error, setError] = useState(""),
    [transitioning, setTransitioning] = useState<string | null>(null);
  const load = useCallback(() => {
    getPharmacyDashboardOrders(pharmacyId)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [pharmacyId]);
  useEffect(load, [load]);
  async function transition(orderId: string, status: string) {
    setTransitioning(orderId);
    setError("");
    try {
      await transitionPharmacyOrder(pharmacyId, orderId, status);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order.");
    } finally {
      setTransitioning(null);
    }
  }
  return (
    <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
      <h2 className="text-xl font-bold">Orders</h2>
      {error && (
        <p role="alert" className="error-state mt-2">
          {error}
        </p>
      )}
      {orders === null && !error && <p className="mt-2">Loading orders…</p>}
      {orders?.length === 0 && (
        <p className="empty-state mt-2">No orders yet.</p>
      )}
      <ul className="mt-3 space-y-3">
        {orders?.map((o) => (
          <li key={o.id} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Order {o.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-500">
                  {o.fulfillmentMethod} · L${Number(o.finalTotal).toFixed(2)}
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
                {ORDER_LABELS[o.status] ?? o.status}
              </span>
            </div>
            {o.items && o.items.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {o.items.map((item) => (
                  <li key={item.id}>
                    {item.name} × {item.quantity}
                  </li>
                ))}
              </ul>
            )}
            {o.status === "under_review" && o.prescriptionId && !isPharmacist && (
              <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                Awaiting pharmacist review — only a pharmacist on staff can
                accept, reject, or request clarification on a prescription.
              </p>
            )}
            {o.status === "under_review" && o.prescriptionId && isPharmacist && (
              <ReviewForm
                pharmacyId={pharmacyId}
                prescriptionId={o.prescriptionId}
                prescriptionVersion={o.prescriptionVersion ?? null}
                onDone={load}
              />
            )}
            {nextStatusesFor(o).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {nextStatusesFor(o).map((next) => (
                  <button
                    key={next}
                    disabled={transitioning === o.id}
                    onClick={() => transition(o.id, next)}
                    className="btn-secondary min-h-9"
                  >
                    Mark {ORDER_LABELS[next] ?? next}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PharmacyManagePage() {
  const params = useParams<{ id: string }>();
  const pharmacyId = params.id;
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null),
    [stats, setStats] = useState<PharmacyStats | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!pharmacyId) return;
    apiRequest<Pharmacy[]>("/pharmacy-dashboard")
      .then((all) => {
        const mine = all.find((p) => p.id === pharmacyId);
        if (!mine) {
          setError("This pharmacy isn't assigned to your account.");
          return;
        }
        setPharmacy(mine);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    getPharmacyStats(pharmacyId)
      .then(setStats)
      .catch(() => {
        /* statistics are a nice-to-have — don't block the rest of the page */
      });
  }, [pharmacyId]);
  return (
    <main className="page-shell max-w-4xl">
      <Link
        href="/account/pharmacy-dashboard"
        className="text-sm text-brand-700 underline"
      >
        ← All pharmacies
      </Link>
      <h1 className="page-title mt-2">
        {pharmacy ? pharmacy.name : "Manage pharmacy"}
      </h1>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {!pharmacy && !error && <p>Loading…</p>}
      {pharmacy && (
        <div className="space-y-6">
          {stats && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Total orders", stats.totalOrders],
                ["Completed", stats.completedOrders],
                ["Pending / in review", stats.pendingOrders],
                ["Revenue", `L$${stats.revenue.toFixed(2)}`],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl border bg-white p-3 dark:bg-slate-900"
                >
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-lg font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
            <h2 className="text-xl font-bold">Profile</h2>
            <p className="mb-3 capitalize text-sm text-slate-500">
              Verification: {pharmacy.status}
            </p>
            <ProfileForm pharmacy={pharmacy} onSaved={setPharmacy} />
          </section>
          <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
            <h2 className="text-xl font-bold">Staff</h2>
            <p className="mb-3 text-sm text-slate-500">
              Only a pharmacist on staff can decide on a prescription review.
            </p>
            <StaffForm pharmacyId={pharmacy.id} />
          </section>
          <ProductsSection pharmacyId={pharmacy.id} />
          <OrdersSection
            pharmacyId={pharmacy.id}
            isPharmacist={stats?.role === "pharmacist"}
          />
        </div>
      )}
    </main>
  );
}
