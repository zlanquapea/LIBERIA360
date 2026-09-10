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
        {items.map((p) => {
          // Nothing in this codebase currently accepts a licence-document
          // upload (Pharmacy.licenceDocumentKey exists but no path ever
          // sets it) — so a licence number is the only submitted evidence
          // an admin can actually inspect today. Withhold "Approved" until
          // at least that much is on file, rather than let a name/address
          // alone pass as a verified licence.
          const hasLicenceNumber = !!p.licenceNumber?.trim();
          return (
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
                  <p className="mt-2 text-sm">
                    Licence #:{" "}
                    {hasLicenceNumber ? (
                      <span className="font-mono">{p.licenceNumber}</span>
                    ) : (
                      <span className="text-amber-700">
                        Not provided
                      </span>
                    )}
                  </p>
                  {!p.licenceDocumentKey && (
                    <p className="text-xs text-slate-500">
                      No licence document on file.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["approved", "rejected", "suspended"].map((d) => (
                    <button
                      key={d}
                      onClick={() => decide(p.id, d)}
                      disabled={d === "approved" && !hasLicenceNumber}
                      title={
                        d === "approved" && !hasLicenceNumber
                          ? "Cannot approve without a licence number on file"
                          : undefined
                      }
                      className="btn-secondary capitalize disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
