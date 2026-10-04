"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/http";

type Report = {
  id: string;
  targetType: string;
  reason: string;
  details: string | null;
  snapshot: {
    text?: string;
    media_url?: string;
    attachments?: Array<{ url: string; name?: string }>;
  };
  createdAt: string;
  reviewedAt: string | null;
  action: string | null;
};
const button =
  "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-600";
function safeUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function SafetyReviewQueue() {
  const { user } = useAuth();
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: Report[];
    hasMore: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError("");
    setConfirm(null);
    if (user?.isAdmin)
      apiRequest<{ data: Report[]; hasMore: boolean }>(
        `/safety/reports?status=${status}&page=${page}`,
        { cache: "no-store" },
      )
        .then((data) => {
          if (!cancelled) setResult(data);
        })
        .catch((err) => {
          if (!cancelled)
            setError(
              err instanceof Error ? err.message : "Unable to load reports.",
            );
        });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.isAdmin, status, page, revision]);
  if (!user?.isAdmin) return null;
  async function review(id: string, action: "hide" | "dismiss") {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/safety/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review report.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:p-6">
      <h2 className="text-xl font-semibold">Post and message reports</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Review the reported content snapshot. Hiding removes the post or message
        from public or conversation views. Every decision is recorded.
      </p>
      <label className="flex flex-wrap items-center gap-3">
        Status{" "}
        <select
          value={status}
          disabled={busy}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          className={`${button} bg-transparent`}
        >
          <option value="open">Needs review</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </label>
      {error && (
        <div role="alert">
          {error}{" "}
          <button
            className={button}
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!result && !error && <p role="status">Loading reports…</p>}
      {result?.data.length === 0 && <p>No reports on this page.</p>}
      {result?.data.map((report) => {
        const media = [
          report.snapshot.media_url,
          ...(report.snapshot.attachments ?? []).map((item) => item.url),
        ]
          .map(safeUrl)
          .filter((url): url is string => !!url);
        return (
          <article
            key={report.id}
            className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"
          >
            <p className="font-semibold capitalize">
              {report.targetType.replaceAll("_", " ")} · {report.reason}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(report.createdAt).toLocaleString()}
            </p>
            <blockquote className="whitespace-pre-wrap break-words border-l-2 border-slate-300 pl-3">
              {report.snapshot.text || "Media attachment"}
            </blockquote>
            {media.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center underline"
              >
                View reported media {index + 1}
              </a>
            ))}
            {report.details && (
              <p className="whitespace-pre-wrap break-words">
                Report details: {report.details}
              </p>
            )}
            {report.reviewedAt ? (
              <p>
                Decision:{" "}
                {report.action === "hide"
                  ? "Content hidden"
                  : "Report dismissed"}{" "}
                · {new Date(report.reviewedAt).toLocaleString()}
              </p>
            ) : confirm === report.id ? (
              <div className="space-y-2">
                <p>
                  Hide this content? The author will no longer be able to
                  display this post or message.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void review(report.id, "hide")}
                  >
                    Confirm hide
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => setConfirm(report.id)}
                >
                  Hide content
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void review(report.id, "dismiss")}
                >
                  Dismiss report
                </button>
              </div>
            )}
          </article>
        );
      })}
      {result && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={button}
            disabled={busy || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className={button}
            disabled={busy || !result.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
