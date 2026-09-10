"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import type { Pharmacy } from "@/lib/pharmacy-api";
export default function AdminPharmacies() {
  const [items, setItems] = useState<Pharmacy[]>([]),
    [message, setMessage] = useState("Loading applications…");
  async function load() {
    try {
      setItems(await apiRequest<Pharmacy[]>("/admin/pharmacies/applications"));
      setMessage("");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to load applications",
      );
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function decide(id: string, decision: string) {
    if (!confirm(`Confirm ${decision} for this pharmacy?`)) return;
    await apiRequest(`/admin/pharmacies/${id}/verification`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    });
    await load();
  }
  return (
    <main>
      <h1 className="text-3xl font-extrabold">Pharmacy oversight</h1>
      <p className="mt-2 text-slate-600">
        Review licence applications, suspend unsafe listings, and audit
        marketplace activity. Sponsorship never affects verification.
      </p>
      {message && (
        <p role="status" className="mt-5">
          {message}
        </p>
      )}
      <div className="mt-6 space-y-3">
        {items.map((p) => (
          <article
            key={p.id}
            className="rounded-2xl border bg-white p-5 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{p.name}</h2>
                <p>
                  {p.address} · <span className="capitalize">{p.status}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["approved", "rejected", "suspended"].map((d) => (
                  <button
                    key={d}
                    onClick={() => decide(p.id, d)}
                    className="btn-secondary capitalize"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
