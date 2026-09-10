"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import type { Pharmacy } from "@/lib/pharmacy-api";
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
        <div className="empty-state">
          No pharmacy is assigned to your account. Submit a pharmacy application
          to begin.
        </div>
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
