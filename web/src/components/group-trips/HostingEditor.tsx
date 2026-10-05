"use client";

import { useState } from "react";
import { PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { PhotoManager } from "@/components/PhotoManager";
import { useAuth } from "@/hooks/useAuth";
import { saveTripHosting, type HostingInput } from "@/lib/group-trips-api";
import {
  ACTIVITY_PRESETS,
  INCLUDE_PRESETS,
  itemIcon,
  money,
} from "@/lib/group-trips";
import type { TripHosting, TripOrganiser } from "@/lib/types";

/** A list of short labels: tap a suggestion to add it, or type your own. */
function ChipList({
  label,
  hint,
  value,
  onChange,
  presets = [],
  placeholder,
  fallbackIcon,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  presets?: string[];
  placeholder: string;
  fallbackIcon: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (item: string) => {
    const v = item.trim();
    if (
      v &&
      !value.some((x) => x.toLowerCase() === v.toLowerCase()) &&
      value.length < 20
    )
      onChange([...value, v]);
  };
  const unused = presets.filter(
    (p) => !value.some((v) => v.toLowerCase() === p.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
        {label}
      </p>
      {hint && (
        <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li
              key={item}
              className="flex items-center gap-1 rounded-full bg-brand-50 py-1 pe-1 ps-3 text-sm font-semibold text-brand-900 dark:bg-brand-950/50 dark:text-brand-100"
            >
              <span aria-hidden>{itemIcon(item, fallbackIcon)}</span> {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(value.filter((x) => x !== item))}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-900"
              >
                <XMarkIcon aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => add(p)}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-500 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300"
            >
              + {p}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          maxLength={100}
          placeholder={placeholder}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          className="flex min-h-11 items-center gap-1 rounded-full border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
        >
          <PlusIcon aria-hidden className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <legend className="sr-only">{title}</legend>
      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
        {title}
      </h3>
      {children}
    </fieldset>
  );
}

const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Turn a trip into an organised one people can book: the poster (photos,
 * tagline, organisers), the price — or free — and spots, what's included,
 * the activities, where the bus leaves from, and the ways to pay.
 */
export function HostingEditor({
  tripId,
  startDate,
  hosting,
  coverImage,
  onSaved,
}: {
  tripId: string;
  startDate: string | null;
  hosting: TripHosting | null;
  coverImage: string | null;
  onSaved: (h: TripHosting) => void;
}) {
  const { token } = useAuth();
  const h = hosting;
  const [free, setFree] = useState(h ? h.isFree : false);
  const [price, setPrice] = useState(h && !h.isFree ? String(h.price) : "");
  const [currency, setCurrency] = useState<"USD" | "LRD">(h?.currency ?? "USD");
  const [deposit, setDeposit] = useState(
    h?.depositAmount != null ? String(h.depositAmount) : "",
  );
  const [balanceDue, setBalanceDue] = useState(h?.balanceDueDate ?? "");
  const [spots, setSpots] = useState(String(h?.spots ?? 30));
  const [maxPer, setMaxPer] = useState(String(h?.maxPerBooking ?? 6));
  const [deadline, setDeadline] = useState(h?.bookingDeadline ?? "");
  const [approval, setApproval] = useState(h?.requireApproval ?? false);
  const [tagline, setTagline] = useState(h?.tagline ?? "");
  const [photos, setPhotos] = useState<string[]>(() => {
    const list = [...(coverImage ? [coverImage] : []), ...(h?.gallery ?? [])];
    return [...new Set(list)];
  });
  const [includes, setIncludes] = useState<string[]>(h?.includes ?? []);
  const [excludes, setExcludes] = useState<string[]>(h?.excludes ?? []);
  const [activities, setActivities] = useState<string[]>(h?.activities ?? []);
  const [meetingPoint, setMeetingPoint] = useState(h?.meetingPoint ?? "");
  const [departure, setDeparture] = useState(h?.departureTime ?? "");
  const [organisers, setOrganisers] = useState<TripOrganiser[]>(
    h?.organisers ?? [],
  );
  const [contactPhone, setContactPhone] = useState(h?.contactPhone ?? "");
  const [goodToKnow, setGoodToKnow] = useState(h?.goodToKnow ?? "");
  const [cash, setCash] = useState(h?.cashEnabled ?? true);
  const [mtn, setMtn] = useState(h?.mtnMomoNumber ?? "");
  const [orange, setOrange] = useState(h?.orangeMoneyNumber ?? "");
  const [accountName, setAccountName] = useState(h?.accountName ?? "");
  const [open, setOpen] = useState(h?.open ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    const input: HostingInput = {
      open,
      tagline: tagline.trim() || null,
      price: free ? 0 : Number(price || 0),
      currency,
      depositAmount: free ? null : numberOrNull(deposit),
      balanceDueDate: !free && deposit ? balanceDue || null : null,
      bookingDeadline: deadline || null,
      spots: Number(spots || 0),
      maxPerBooking: Number(maxPer || 6),
      requireApproval: free ? approval : false,
      includes,
      excludes,
      activities,
      meetingPoint: meetingPoint.trim() || null,
      departureTime: departure || null,
      organisers: organisers.filter((o) => o.name.trim()),
      gallery: photos.slice(1),
      coverImage: photos[0] ?? null,
      goodToKnow: goodToKnow.trim() || null,
      contactPhone: contactPhone.trim() || null,
      cashEnabled: cash,
      mtnMomoNumber: mtn.trim() || null,
      orangeMoneyNumber: orange.trim() || null,
      accountName: accountName.trim() || null,
    };
    if (!free && !(input.price > 0)) {
      setError("Set a price per person, or make the trip free.");
      setSaving(false);
      return;
    }
    try {
      onSaved(await saveTripHosting(tripId, input));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!startDate)
    return (
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Give the trip its dates first — travellers need to know when it leaves.
      </p>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Card title="The poster">
        {token && (
          <PhotoManager
            token={token}
            images={photos}
            onChange={setPhotos}
            label="Photos — the first one is the poster"
            maxPhotos={9}
            aspect="4:3"
          />
        )}
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={140}
            placeholder="Law. Culture. Connection."
            className="input mt-1 w-full"
          />
        </label>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
            Organised by
          </p>
          <p className="-mt-1 text-xs text-slate-500">
            Your group, club or tour company — their logos go on the poster.
          </p>
          {organisers.map((o, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex gap-2">
                <input
                  value={o.name}
                  onChange={(e) =>
                    setOrganisers((list) =>
                      list.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                  maxLength={80}
                  placeholder="e.g. Tuzee en Afrique Tours"
                  aria-label={`Organiser ${i + 1} name`}
                  className="input flex-1"
                />
                <button
                  type="button"
                  aria-label={`Remove organiser ${i + 1}`}
                  onClick={() =>
                    setOrganisers((list) => list.filter((_, j) => j !== i))
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600"
                >
                  <TrashIcon aria-hidden className="h-4 w-4" />
                </button>
              </div>
              {token && (
                <PhotoManager
                  token={token}
                  images={o.logo ? [o.logo] : []}
                  onChange={(imgs) =>
                    setOrganisers((list) =>
                      list.map((x, j) =>
                        j === i ? { ...x, logo: imgs[0] ?? null } : x,
                      ),
                    )
                  }
                  label="Logo"
                  maxPhotos={1}
                  aspect="1:1"
                />
              )}
            </div>
          ))}
          {organisers.length < 6 && (
            <button
              type="button"
              onClick={() =>
                setOrganisers((list) => [...list, { name: "", logo: null }])
              }
              className="flex w-fit min-h-10 items-center gap-1 rounded-full border border-dashed border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:border-brand-500 dark:border-slate-600 dark:text-slate-300"
            >
              <PlusIcon aria-hidden className="h-4 w-4" /> Add an organiser
            </button>
          )}
        </div>
      </Card>

      <Card title="Price and spots">
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Price"
        >
          {[
            {
              v: false,
              title: "Paid trip",
              detail: "Travellers pay per person",
            },
            { v: true, title: "Free trip", detail: "Anyone can book a spot" },
          ].map((o) => (
            <button
              key={o.title}
              type="button"
              role="radio"
              aria-checked={free === o.v}
              onClick={() => setFree(o.v)}
              className={`rounded-2xl border p-3 text-start ${free === o.v ? "border-brand-600 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <span className="block text-sm font-bold text-slate-950 dark:text-slate-50">
                {o.title}
              </span>
              <span className="block text-xs text-slate-500">{o.detail}</span>
            </button>
          ))}
        </div>
        {!free && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
              Price per person
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
                className="input mt-1 w-full"
              />
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "LRD")}
                className="input mt-1 w-full"
              >
                <option value="USD">US$</option>
                <option value="LRD">L$</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
              Deposit to hold a spot (optional)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="50"
                className="input mt-1 w-full"
              />
            </label>
            {deposit && (
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Balance due by
                <input
                  type="date"
                  value={balanceDue}
                  max={startDate.slice(0, 10)}
                  onChange={(e) => setBalanceDue(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
            )}
            {deposit && Number(price) > 0 && (
              <p className="text-xs text-slate-500 sm:col-span-3">
                Travellers can pay {money(Number(deposit), currency)} now and{" "}
                {money(Math.max(0, Number(price) - Number(deposit)), currency)}{" "}
                later — or everything at once.
              </p>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Spots available
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={spots}
              onChange={(e) => setSpots(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Max spots per booking
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={maxPer}
              onChange={(e) => setMaxPer(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Bookings close (optional)
            <input
              type="date"
              value={deadline}
              max={startDate.slice(0, 10)}
              onChange={(e) => setDeadline(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
        </div>
        {free && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={approval}
              onChange={(e) => setApproval(e.target.checked)}
              className="h-5 w-5 accent-brand-700"
            />
            Let me approve each booking first
          </label>
        )}
      </Card>

      <Card title="What's in it">
        <ChipList
          label="Inclusive of"
          value={includes}
          onChange={setIncludes}
          presets={INCLUDE_PRESETS}
          placeholder="Add something that's included"
          fallbackIcon="✓"
        />
        <ChipList
          label="Activities"
          value={activities}
          onChange={setActivities}
          presets={ACTIVITY_PRESETS}
          placeholder="Add an activity"
          fallbackIcon="✨"
        />
        <ChipList
          label="Not included (optional)"
          hint="So nobody is surprised — e.g. lunch, personal spending, drinks."
          value={excludes}
          onChange={setExcludes}
          placeholder="Add something that's not included"
          fallbackIcon="•"
        />
      </Card>

      <Card title="On the day">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Meeting point
            <input
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              maxLength={200}
              placeholder="University of Liberia, Capitol Hill gate"
              className="input mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Departure time
            <input
              type="time"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
        </div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Good to know (optional)
          <textarea
            rows={3}
            maxLength={2000}
            value={goodToKnow}
            onChange={(e) => setGoodToKnow(e.target.value)}
            placeholder="Bring your ID, swimwear and mosquito repellent. Two people per room."
            className="input mt-1 w-full"
          />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Your phone for travellers (call and WhatsApp)
          <input
            type="tel"
            inputMode="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="0886 123 456"
            className="input mt-1 w-full"
          />
        </label>
      </Card>

      {!free && (
        <Card title="How travellers pay">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={cash}
              onChange={(e) => setCash(e.target.checked)}
              className="h-5 w-5 accent-brand-700"
            />
            Cash, handed to you
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full bg-yellow-400"
                />{" "}
                MTN MoMo number
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={mtn}
                onChange={(e) => setMtn(e.target.value)}
                placeholder="0886 …"
                className="input mt-1 w-full"
              />
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full bg-orange-500"
                />{" "}
                Orange Money number
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={orange}
                onChange={(e) => setOrange(e.target.value)}
                placeholder="0777 …"
                className="input mt-1 w-full"
              />
            </label>
          </div>
          {(mtn || orange) && (
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Name on the mobile money account
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                maxLength={120}
                placeholder="As travellers will see it when they send"
                className="input mt-1 w-full"
              />
            </label>
          )}
        </Card>
      )}

      {hosting && (
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
            className="h-5 w-5 accent-brand-700"
          />
          Taking bookings
        </label>
      )}

      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Saved — your trip page is up to date.
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="min-h-12 rounded-full bg-brand-700 px-6 text-base font-bold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {saving ? "Saving…" : hosting ? "Save changes" : "Open for bookings"}
      </button>
    </form>
  );
}
