"use client";

import { useCallback, useEffect, useState } from "react";
import { CLINIC_STATUS_STYLES, DOCTOR_STATUS_COPY } from "@/components/prescriptions/clinic-labels";
import {
  getClinicApplications,
  getDoctorApplications,
  verifyClinic,
  verifyDoctor,
  type ClinicApplication,
  type ClinicStatus,
  type DoctorApplication,
  type DoctorVerificationStatus,
} from "@/lib/clinic-api";

/**
 * Who may prescribe on LIBERIA360. A clinic is checked against its
 * Ministry of Health facility licence; each doctor against the Liberia
 * Medical and Dental Council register. Only verified doctors at verified
 * clinics can write e-prescriptions.
 */
export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<ClinicApplication[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorApplication[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([getClinicApplications(), getDoctorApplications()])
      .then(([c, d]) => {
        setClinics(c);
        setDoctors(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load applications."));
  }, []);
  useEffect(load, [load]);

  async function decide(run: () => Promise<unknown>) {
    setError("");
    try {
      await run();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the decision.");
    }
  }

  function clinicDecision(c: ClinicApplication, decision: ClinicStatus) {
    const notes =
      decision === "approved"
        ? undefined
        : window.prompt(`Why is ${c.name} ${decision}? The clinic admin will see this.`);
    if (decision !== "approved" && !notes) return;
    void decide(() => verifyClinic(c.id, decision, notes ?? undefined));
  }

  function doctorDecision(d: DoctorApplication, decision: DoctorVerificationStatus) {
    const notes =
      decision === "verified"
        ? undefined
        : window.prompt(`Why isn't Dr ${d.fullName}'s licence verified? They will see this.`);
    if (decision !== "verified" && !notes) return;
    void decide(() => verifyDoctor(d.id, decision, notes ?? undefined));
  }

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-extrabold">Clinics &amp; doctors</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Check each clinic&apos;s facility licence with the Ministry of Health and each doctor&apos;s licence
          against the Liberia Medical and Dental Council register before approving. Only verified doctors at
          verified clinics can prescribe.
        </p>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Doctors</h2>
        {doctors === null && !error && <p>Loading…</p>}
        {doctors?.length === 0 && <p className="empty-state">No doctors have applied yet.</p>}
        {doctors?.map((d) => (
          <article key={d.id} className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold">Dr {d.fullName}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {d.specialty} · Licence <span className="font-mono font-semibold">{d.licenceNumber}</span>
                </p>
                <p className="text-sm text-slate-500">
                  {d.user?.name} · {d.user?.email}
                  {d.clinics.length > 0 && ` · ${d.clinics.map((c) => c.name).join(", ")}`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DOCTOR_STATUS_COPY[d.verificationStatus].style}`}>
                {DOCTOR_STATUS_COPY[d.verificationStatus].label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.verificationStatus !== "verified" && (
                <button onClick={() => doctorDecision(d, "verified")} className="btn-primary min-h-9">
                  Licence checked: verify
                </button>
              )}
              {d.verificationStatus !== "rejected" && (
                <button onClick={() => doctorDecision(d, "rejected")} className="btn-secondary min-h-9 text-red-700">
                  {d.verificationStatus === "verified" ? "Revoke" : "Reject"}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Clinics</h2>
        {clinics === null && !error && <p>Loading…</p>}
        {clinics?.length === 0 && <p className="empty-state">No clinics have applied yet.</p>}
        {clinics?.map((c) => (
          <article key={c.id} className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold">{c.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {c.address}, {c.location} · {c.telephone}
                </p>
                <p className="text-sm text-slate-500">
                  Facility licence:{" "}
                  <span className="font-mono font-semibold">{c.licenceNumber || "not given"}</span>
                  {c.pharmacy && ` · Pharmacy: ${c.pharmacy.name}`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${CLINIC_STATUS_STYLES[c.status]}`}>
                {c.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status !== "approved" && (
                <button
                  disabled={!c.licenceNumber}
                  title={c.licenceNumber ? undefined : "Needs a facility licence number first"}
                  onClick={() => clinicDecision(c, "approved")}
                  className="btn-primary min-h-9 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {c.status === "pending" && (
                <button onClick={() => clinicDecision(c, "rejected")} className="btn-secondary min-h-9 text-red-700">
                  Reject
                </button>
              )}
              {c.status === "approved" && (
                <button onClick={() => clinicDecision(c, "suspended")} className="btn-secondary min-h-9 text-red-700">
                  Suspend
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
