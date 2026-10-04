"use client";
import { useCallback, useEffect, useState } from "react";
import { BanknotesIcon, PlusIcon } from "@heroicons/react/24/outline";
import { HttpError } from "@/lib/http";
import {
  getTripBudget,
  saveTripBudget,
  parseBudgetAmount,
  type TripBudget,
  type TripExpense,
} from "@/lib/trip-budget-api";

const field =
  "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700";
const primary = `${button} border-transparent bg-brand-800 text-white dark:bg-brand-700`;
const categories = ["transport", "stay", "food", "activity", "other"];
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function TripBudgetPanel({
  tripId,
  onReadyChange,
}: {
  tripId: string;
  onReadyChange?: (ready: boolean | null) => void;
}) {
  const [data, setData] = useState<TripBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reload, setReload] = useState(0);
  const [currency, setCurrency] = useState<"USD" | "LRD">("USD");
  const [limit, setLimit] = useState("");
  const [name, setName] = useState("");
  const [expense, setExpense] = useState<TripExpense | null>(null);
  const [amount, setAmount] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  useEffect(() => {
    onReadyChange?.(data ? data.budgetMinor > 0 : null);
  }, [data, onReadyChange]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError("");
    setConflict(false);
    getTripBudget(tripId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setCurrency(result.currency);
        setLimit(
          result.budgetMinor ? (result.budgetMinor / 100).toFixed(2) : "",
        );
        setExpense(null);
        setRemoveId(null);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Unable to load budget.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, reload]);
  const save = useCallback(
    async (next: TripBudget) => {
      if (busy || conflict) return false;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        setData(await saveTripBudget(tripId, next));
        setNotice("Changes saved.");
        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to save. Please try again.",
        );
        if (err instanceof HttpError && err.status === 409) setConflict(true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [tripId, busy, conflict],
  );
  if (loading)
    return (
      <section
        className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"
        aria-label="Trip budget"
      >
        <p role="status">Loading trip budget…</p>
      </section>
    );
  if (!data)
    return (
      <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
        <p role="alert">{error}</p>
        <button
          className={button}
          onClick={() => setReload((value) => value + 1)}
        >
          Retry budget
        </button>
      </section>
    );
  const money = (minor: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: data.currency,
      currencyDisplay: "code",
    }).format(minor / 100);
  const person = (id: string) =>
    data.travelers.find((item) => item.id === id)?.name ?? "Traveler";
  const disabled = busy || conflict;
  const startExpense = (existing?: TripExpense) => {
    setError("");
    setNotice("");
    setRemoveId(null);
    setExpense(
      existing
        ? { ...existing, splitBetween: [...existing.splitBetween] }
        : {
            id: crypto.randomUUID(),
            description: "",
            category: "transport",
            amountMinor: 0,
            paidBy: data.travelers[0]?.id ?? "",
            splitBetween: data.travelers.map((item) => item.id),
            date: today(),
          },
    );
    setAmount(existing ? (existing.amountMinor / 100).toFixed(2) : "");
  };
  async function submitExpense(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !expense) return;
    const amountMinor = parseBudgetAmount(amount);
    if (
      amountMinor === null ||
      amountMinor <= 0 ||
      !expense.splitBetween.length ||
      !expense.paidBy ||
      !expense.description.trim()
    ) {
      setError(
        "Enter an amount greater than zero, a description, a payer, and at least one traveler to split with.",
      );
      return;
    }
    const next = {
      ...expense,
      amountMinor,
      description: expense.description.trim(),
    };
    const exists = data.expenses.some((item) => item.id === next.id);
    if (
      await save({
        ...data,
        expenses: exists
          ? data.expenses.map((item) => (item.id === next.id ? next : item))
          : [...data.expenses, next],
      })
    )
      setExpense(null);
  }
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-3 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          <BanknotesIcon aria-hidden className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-xl font-bold">Budget & expenses</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Private to your trip members. Track what you spend and who paid.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
        {[
          ["Budget", data.budgetMinor ? money(data.budgetMinor) : "Not set"],
          ["Spent", money(data.summary.spentMinor)],
          [
            data.summary.remainingMinor < 0 ? "Over budget" : "Remaining",
            data.budgetMinor
              ? money(Math.abs(data.summary.remainingMinor))
              : "Set a budget",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 break-words text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>
      {data.budgetMinor > 0 && (
        <progress
          aria-label="Budget used"
          max={data.budgetMinor}
          value={Math.min(data.budgetMinor, data.summary.spentMinor)}
          className="h-2 w-full accent-emerald-600"
        />
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200"
        >
          {error}
          {conflict && (
            <button
              className={`${button} mt-3`}
              onClick={() => setReload((value) => value + 1)}
            >
              Reload latest budget (discard draft)
            </button>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}
      {!data.canEdit && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You have view-only access. Ask the trip owner or an editor to update
          expenses.
        </p>
      )}
      {data.canEdit && (
        <details
          className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          open={data.travelers.length === 0 || undefined}
        >
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Budget settings & travelers
          </summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const budgetMinor = parseBudgetAmount(limit || "0");
              if (budgetMinor === null) {
                setError("Enter a valid budget with up to two decimal places.");
                return;
              }
              await save({ ...data, currency, budgetMinor });
            }}
          >
            <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Currency
                <select
                  className={field}
                  value={currency}
                  disabled={data.expenses.length > 0}
                  onChange={(event) =>
                    setCurrency(event.target.value as "USD" | "LRD")
                  }
                >
                  <option value="USD">USD — US dollars</option>
                  <option value="LRD">LRD — Liberian dollars</option>
                </select>
              </label>
              <label className="text-sm">
                Trip budget
                <input
                  className={field}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                />
              </label>
            </fieldset>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              One currency per trip. Currency changes are locked while expenses
              exist. No automatic conversion. Set 0 to leave the budget unset.
            </p>
            <button className={button} disabled={disabled}>
              Save budget
            </button>
          </form>
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="font-semibold">Travelers</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Names are for splitting costs only. Adding a name does not invite
              anyone to the trip.
            </p>
            <ul className="my-3 space-y-2">
              {data.travelers.map((traveler) => {
                const used = data.expenses.some(
                  (item) =>
                    item.paidBy === traveler.id ||
                    item.splitBetween.includes(traveler.id),
                );
                return (
                  <li
                    key={traveler.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 break-words text-sm">
                      {traveler.name}
                    </span>
                    <button
                      className={button}
                      disabled={disabled || used || !!expense}
                      title={
                        used
                          ? "This traveler is included in an expense."
                          : undefined
                      }
                      onClick={() =>
                        void save({
                          ...data,
                          travelers: data.travelers.filter(
                            (item) => item.id !== traveler.id,
                          ),
                        })
                      }
                      aria-label={`Remove ${traveler.name}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!name.trim()) return;
                if (
                  data.travelers.some(
                    (item) =>
                      item.name.toLowerCase() === name.trim().toLowerCase(),
                  )
                ) {
                  setError("Use a distinct name for each traveler.");
                  return;
                }
                if (
                  await save({
                    ...data,
                    travelers: [
                      ...data.travelers,
                      { id: crypto.randomUUID(), name: name.trim() },
                    ],
                  })
                )
                  setName("");
              }}
            >
              <label className="min-w-0 flex-1 text-sm">
                Traveler name
                <input
                  maxLength={80}
                  className={field}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={disabled || data.travelers.length >= 50}
                />
              </label>
              <button
                className={button}
                disabled={disabled || data.travelers.length >= 50}
              >
                Add traveler
              </button>
            </form>
          </div>
        </details>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">
          Expenses{" "}
          <span className="text-sm font-normal text-slate-500">
            ({data.expenses.length})
          </span>
        </h3>
        {data.canEdit && (
          <button
            className={primary}
            disabled={
              disabled ||
              !data.travelers.length ||
              data.expenses.length >= 500 ||
              !!expense
            }
            onClick={() => startExpense()}
          >
            <PlusIcon aria-hidden className="h-4 w-4" />
            Add expense
          </button>
        )}
      </div>
      {!data.travelers.length && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Start by adding yourself and anyone sharing the costs.
        </p>
      )}
      {expense && (
        <form
          onSubmit={submitExpense}
          className="space-y-3 rounded-xl border border-brand-200 p-4 dark:border-brand-900"
        >
          <h3 className="font-semibold">
            {data.expenses.some((item) => item.id === expense.id)
              ? "Edit expense"
              : "New expense"}
          </h3>
          <fieldset disabled={disabled} className="space-y-3">
            <label className="block text-sm">
              Description
              <input
                autoFocus
                className={field}
                maxLength={160}
                required
                value={expense.description}
                onChange={(event) =>
                  setExpense({ ...expense, description: event.target.value })
                }
                placeholder="e.g. Transport to Robertsport"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Amount ({data.currency})
                <input
                  className={field}
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="text-sm">
                Date
                <input
                  type="date"
                  className={field}
                  required
                  value={expense.date}
                  onChange={(event) =>
                    setExpense({ ...expense, date: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Category
                <select
                  className={field}
                  value={expense.category}
                  onChange={(event) =>
                    setExpense({ ...expense, category: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category[0].toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Paid by
                <select
                  className={field}
                  value={expense.paidBy}
                  onChange={(event) =>
                    setExpense({ ...expense, paidBy: event.target.value })
                  }
                >
                  {data.travelers.map((traveler) => (
                    <option key={traveler.id} value={traveler.id}>
                      {traveler.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">
                Split equally between
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.travelers.map((traveler) => (
                  <label
                    key={traveler.id}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={expense.splitBetween.includes(traveler.id)}
                      onChange={(event) =>
                        setExpense({
                          ...expense,
                          splitBetween: event.target.checked
                            ? [...expense.splitBetween, traveler.id]
                            : expense.splitBetween.filter(
                                (id) => id !== traveler.id,
                              ),
                        })
                      }
                    />
                    {traveler.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose just one traveler for a personal expense. Any extra cents
              are allocated consistently.
            </p>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={disabled}>
              {busy ? "Saving…" : "Save expense"}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setExpense(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!data.expenses.length && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          No expenses yet. Record actual spending here; listed stop prices
          remain estimates.
        </p>
      )}
      <ul className="space-y-3">
        {[...data.expenses]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="min-w-0 break-words font-medium">
                  {item.description}
                </p>
                <strong>{money(item.amountMinor)}</strong>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {item.date} · {item.category} · Paid by {person(item.paidBy)}
              </p>
              <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                Split: {item.splitBetween.map(person).join(", ")}
              </p>
              {data.canEdit && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {removeId === item.id ? (
                    <>
                      <span className="w-full text-sm">
                        Delete this expense and recalculate balances?
                      </span>
                      <button
                        className={button}
                        disabled={disabled}
                        onClick={async () => {
                          if (
                            await save({
                              ...data,
                              expenses: data.expenses.filter(
                                (entry) => entry.id !== item.id,
                              ),
                            })
                          )
                            setRemoveId(null);
                        }}
                      >
                        Confirm delete
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => setRemoveId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={button}
                        disabled={disabled || !!expense}
                        onClick={() => startExpense(item)}
                      >
                        Edit
                      </button>
                      <button
                        className={button}
                        disabled={disabled || !!expense}
                        onClick={() => setRemoveId(item.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
      </ul>
      {data.expenses.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="font-semibold">Spending by category</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(data.summary.categories).map(
              ([category, total]) => (
                <div
                  key={category}
                  className="flex justify-between gap-3 text-sm"
                >
                  <dt className="capitalize">{category}</dt>
                  <dd>{money(total)}</dd>
                </div>
              ),
            )}
          </dl>
          <h3 className="font-semibold">Group balances</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Based on recorded expenses. These are balances, not payment requests
            or proof of repayment.
          </p>
          {data.summary.balances.map((balance) => (
            <div
              key={balance.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
            >
              <div>
                <p className="break-words font-medium">{balance.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paid {money(balance.paidMinor)} · Share{" "}
                  {money(balance.shareMinor)}
                </p>
              </div>
              <p className="text-sm font-semibold">
                {balance.netMinor > 0
                  ? `Gets back ${money(balance.netMinor)}`
                  : balance.netMinor < 0
                    ? `Owes ${money(-balance.netMinor)}`
                    : "Even"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
