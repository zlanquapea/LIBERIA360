"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import {
  createPharmacy,
  type Pharmacy,
  type PharmacyProfileInput,
} from "@/lib/pharmacy-api";

const EMPTY_APPLICATION: PharmacyProfileInput = {
  name: "",
  address: "",
  location: "",
  telephone: "",
  licenceNumber: "",
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFee: 0,
};

// createPharmacy() lands the pharmacy in "pending" status — visible only to
// its own staff until an admin approves it via /admin/pharmacies (see that
// page's own licence-number check), so this form is deliberately just
// enough to get an application on file, not the full profile editor
// ([id]/page.tsx's ProfileForm covers logo/cover/coordinates once approved).
function ApplicationForm({ onCreated }: { onCreated: (p: Pharmacy) => void }) {
  const [form, setForm] = useState(EMPTY_APPLICATION);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createPharmacy({
        ...form,
        licenceNumber: form.licenceNumber || undefined,
      });
      onCreated(created);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not submit application.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="empty-state mt-2 grid gap-3 text-left sm:grid-cols-2"
    >
      <p className="sm:col-span-2">
        No pharmacy is assigned to your account. Submit a pharmacy
        application to begin.
      </p>
      <label>
        Pharmacy name
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
          onChange={(e) =>
            setForm((f) => ({ ...f, address: e.target.value }))
          }
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
        Delivery fee (L$)
        <input
          required
          type="number"
          min={0}
          step="0.01"
          className="input mt-1 w-full"
          value={form.deliveryFee}
          onChange={(e) =>
            setForm((f) => ({ ...f, deliveryFee: Number(e.target.value) }))
          }
        />
      </label>
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
      <button disabled={saving} className="btn-primary sm:col-span-2">
        {saving ? "Submitting…" : "Submit application"}
      </button>
      {error && (
        <p role="alert" className="error-state sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}

export default function PharmacyDashboard() {
  const [items, setItems] = useState<Pharmacy[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    apiRequest<Pharmacy[]>("/pharmacy-dashboard")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="page-shell max-w-5xl">
      <h1 className="page-title">Pharmacy dashboard</h1>
      <p className="mb-5">
        Manage your profiles, inventory, orders, and pharmacist reviews. Access
        is limited to assigned pharmacy staff.
      </p>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {items === null && !error && <p>Loading dashboard…</p>}
      {items?.length === 0 && (
        <ApplicationForm
          onCreated={(p) => setItems((prev) => [...(prev ?? []), p])}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {items?.map((p) => (
          <article
            key={p.id}
            className="rounded-2xl border bg-white p-5 dark:bg-slate-900"
          >
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="capitalize">Verification: {p.status}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="btn-secondary" href={`/pharmacies/${p.slug}`}>
                View storefront
              </Link>
              <Link
                className="btn-primary"
                href={`/account/pharmacy-dashboard/${p.id}`}
              >
                Manage profile & products
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
