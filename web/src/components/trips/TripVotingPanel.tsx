"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import { AddTripStop } from "@/components/AddTripStop";
type Suggestion = {
  id: string;
  title: string;
  input: { day: number };
  votes: number;
  voted: boolean;
  mine: boolean;
};
type Voting = { items: Suggestion[]; isOwner: boolean };
export function TripVotingPanel({
  tripId,
  durationDays,
  onAdded,
}: {
  tripId: string;
  durationDays: number;
  onAdded: () => void;
}) {
  const [data, setData] = useState<Voting | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/itineraries/${tripId}/suggestions`;
  const refresh = async () =>
    setData(await apiRequest<Voting>(path, { cache: "no-store" }));
  useEffect(() => {
    let active = true;
    apiRequest<Voting>(path, { cache: "no-store" })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("Could not load voting. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function act(suffix: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(path + suffix, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await refresh();
      if (suffix.endsWith("/choose")) onAdded();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700 space-y-3">
      <h2 className="text-lg font-bold">Group voting</h2>
      <p className="text-sm text-slate-500">
        Suggest stops and vote for your favorites. One vote per person per
        suggestion. The owner adds the final choices.
      </p>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError("");
          refresh().catch(() => setError("Could not refresh voting."));
        }}
        className="text-sm underline"
      >
        Refresh votes
      </button>
      {!data && !error && <p>Loading votes…</p>}
      {data && (
        <>
          <AddTripStop
            itineraryId={tripId}
            durationDays={durationDays}
            onAdded={() => {
              refresh().catch(() =>
                setError("Suggestion saved. Refresh to see it."),
              );
            }}
            onSuggest={async (input) => {
              await apiRequest(path, {
                method: "POST",
                body: JSON.stringify(input),
              });
            }}
          />
          {data.items.length === 0 && (
            <p className="text-sm">
              No suggestions yet. Add the first one above.
            </p>
          )}
          <ul className="space-y-3">
            {data.items.map((s) => (
              <li
                key={s.id}
                className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
              >
                <p className="font-semibold">
                  {s.title} · Day {s.input.day}
                </p>
                <p className="text-sm">
                  {s.votes} {s.votes === 1 ? "vote" : "votes"}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={s.voted}
                    onClick={() =>
                      act(`/${s.id}/vote`, "PUT", { voted: !s.voted })
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    {s.voted ? "Remove my vote" : "Vote"}
                  </button>
                  {data.isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(`/${s.id}/choose`, "POST")}
                      className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white"
                    >
                      Add to itinerary
                    </button>
                  )}
                  {(data.isOwner || s.mine) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(`/${s.id}`, "DELETE")}
                      className="text-sm underline"
                    >
                      Remove suggestion
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
