"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/http";

const button =
  "min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700";
const panel =
  "rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to save. Please try again.";

export function SafetyControls({
  targetType,
  targetId,
  creatorId,
  accountId,
  onBlocked,
}: {
  targetType: "creator_post" | "conversation_message";
  targetId: string;
  creatorId?: string;
  accountId?: string;
  onBlocked?: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState("");
  if (!user || accountId === user.id) return null;
  async function submit(kind: "report" | "block") {
    setBusy(true);
    setError("");
    try {
      if (kind === "report") {
        await apiRequest("/safety/reports", {
          method: "POST",
          body: JSON.stringify({
            targetType,
            targetId,
            reason,
            details: details.trim() || undefined,
          }),
        });
        setReported(true);
      } else {
        await apiRequest(
          `/safety/blocks/${creatorId ? `creator/${creatorId}` : accountId}`,
          { method: "POST" },
        );
        setBlocked(true);
        setConfirmBlock(false);
        if (creatorId)
          window.dispatchEvent(
            new CustomEvent("liberia360:creator-blocked", {
              detail: creatorId,
            }),
          );
        onBlocked?.();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="my-1 text-xs">
      <summary className="min-h-11 cursor-pointer rounded-xl px-3 py-3 text-slate-500 dark:text-slate-400">
        Safety options
      </summary>
      <div className={`${panel} space-y-3`}>
        <p className="font-semibold">Report or block</p>
        {reported ? (
          <p role="status">Report sent to the review team.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit("report");
            }}
          >
            <p>
              Only this post or message and your explanation are sent for
              review. Your name is not shown to the reported account.
            </p>
            <label className="block">
              Reason
              <select
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent p-2 dark:border-slate-600"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="fraud">Fraud or scam</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              Details (optional)
              <textarea
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-600"
              />
            </label>
            <button className={button} disabled={busy}>
              Send report
            </button>
          </form>
        )}
        {(creatorId || accountId) && (
          <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
            {blocked ? (
              <p role="status">
                Account blocked. Manage blocks in Account settings.
              </p>
            ) : confirmBlock ? (
              <>
                <p className="mb-3">
                  Block this account? Their posts will be hidden from your feed.
                  Messages between you will stop, including in shared
                  conversations. Existing bookings and orders stay active. You
                  can unblock them in Account settings.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void submit("block")}
                  >
                    Confirm block
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setConfirmBlock(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                className={button}
                disabled={busy}
                onClick={() => setConfirmBlock(true)}
              >
                Block account
              </button>
            )}
          </div>
        )}
        {busy && <p role="status">Saving…</p>}
        {error && (
          <p role="alert" className="text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}

export function BlockedAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setAccounts(null);
    setError("");
    if (user)
      apiRequest<Array<{ id: string; name: string }>>("/safety/blocks", {
        cache: "no-store",
      })
        .then((data) => {
          if (!cancelled) setAccounts(data);
        })
        .catch((err) => {
          if (!cancelled) setError(errorText(err));
        });
    return () => {
      cancelled = true;
    };
  }, [user?.id, retry]);
  if (!user) return null;
  async function unblock(id: string) {
    setBusy(id);
    setError("");
    try {
      await apiRequest(`/safety/blocks/${id}`, { method: "DELETE" });
      setAccounts((current) => current?.filter((item) => item.id !== id) ?? []);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className={`${panel} space-y-3`}>
      <h2 className="text-lg font-semibold">Blocked accounts</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Unblock an account to allow messages and show their posts in your feed
        again. Their own block settings still apply.
      </p>
      {error && (
        <div role="alert">
          {error}{" "}
          <button
            className={button}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!accounts && !error && <p role="status">Loading…</p>}
      {accounts?.length === 0 && <p>No blocked accounts.</p>}
      {accounts?.map((account) => (
        <div
          key={account.id}
          className="flex items-center justify-between gap-3"
        >
          <span className="min-w-0 break-words">{account.name}</span>
          <button
            className={button}
            disabled={busy !== null}
            onClick={() => void unblock(account.id)}
          >
            {busy === account.id ? "Unblocking…" : "Unblock"}
          </button>
        </div>
      ))}
    </section>
  );
}
