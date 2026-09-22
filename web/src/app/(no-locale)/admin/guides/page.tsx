"use client";

import { useEffect, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import {
  AdminPageHeader,
  EmptyState,
  LoadingState,
  Panel,
} from "@/components/admin-ui";
import { useAuth } from "@/hooks/useAuth";
import { authHeader } from "@/lib/http";
import {
  getPendingGuideApplications,
  setGuideVerification,
  type PendingGuideApplication,
} from "@/lib/guides-api";

function GuideApplicationsReview() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<
    PendingGuideApplication[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function load() {
    if (!token) return;
    setError(null);
    try {
      setApplications(await getPendingGuideApplications(token));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load guide applications.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function review(
    application: PendingGuideApplication,
    status: "verified" | "rejected",
  ) {
    if (!token) return;
    if (status === "rejected" && !reasons[application.id]?.trim()) {
      setError("Add a reason before rejecting an application.");
      return;
    }
    setBusyId(application.id);
    setError(null);
    try {
      await setGuideVerification(
        token,
        application.id,
        status,
        reasons[application.id],
      );
      setApplications(
        (current) =>
          current?.filter((item) => item.id !== application.id) ?? [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update this application.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function openDocument(application: PendingGuideApplication) {
    if (!token || !application.verificationDocumentKey) return;
    const response = await fetch(
      `/api/v1/admin/guides/${application.id}/verification-document`,
      {
        headers: authHeader(token),
      },
    );
    if (!response.ok) {
      setError("The verification document could not be opened.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (applications === null && !error)
    return <LoadingState label="Loading guide applications…" />;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Guide Applications"
        description="Review identity and experience applications before guides appear publicly."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        }
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {applications?.length === 0 ? (
        <EmptyState
          title="No pending guide applications"
          description="New applications will appear here for review."
        />
      ) : (
        <div className="grid gap-4">
          {applications?.map((application) => (
            <Panel key={application.id} title={application.slug}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <strong>Type:</strong>{" "}
                    {application.guideType.replaceAll("_", " ")}
                  </p>
                  <p>
                    <strong>Location:</strong> {application.city}
                    {application.county?.name
                      ? `, ${application.county.name}`
                      : ""}
                  </p>
                  <p>
                    <strong>Languages:</strong>{" "}
                    {application.languages.join(", ") || "Not provided"}
                  </p>
                  <p>
                    <strong>WhatsApp:</strong>{" "}
                    {application.whatsappNumber || "Not provided"}
                  </p>
                  <p>
                    <strong>LTA licence:</strong>{" "}
                    {application.ltaLicenseNumber || "Not provided"}
                  </p>
                  <p className="whitespace-pre-wrap pt-2 text-slate-800 dark:text-slate-100">
                    {application.bio}
                  </p>
                  <p className="text-xs text-slate-500">
                    Submitted {new Date(application.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:max-w-xs lg:flex-col">
                  {application.verificationDocumentKey ? (
                    <button
                      type="button"
                      onClick={() => void openDocument(application)}
                      className="min-h-11 rounded-lg border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950/30"
                    >
                      View verification document
                    </button>
                  ) : (
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      No verification document uploaded
                    </span>
                  )}
                  <textarea
                    value={reasons[application.id] ?? ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [application.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional approval note or required changes"
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-700"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === application.id}
                      onClick={() => void review(application, "verified")}
                      className="min-h-11 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === application.id}
                      onClick={() => void review(application, "rejected")}
                      className="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminGuidesPage() {
  return (
    <AdminGate>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <GuideApplicationsReview />
      </main>
    </AdminGate>
  );
}
