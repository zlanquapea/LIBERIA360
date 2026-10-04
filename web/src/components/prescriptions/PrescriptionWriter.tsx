'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import {
  issuePrescription,
  lookupPatient,
  searchClinicCatalog,
  type CatalogHit,
  type EPrescription,
  type MyClinic,
} from '@/lib/clinic-api';
import { DOSAGE_PRESETS, suggestedQuantity } from '@/lib/prescriptions';
import { money } from '@/lib/pharmacy-ordering';
import { EPrescriptionCard } from './EPrescriptionCard';

type Line = {
  key: number;
  medicine: string;
  strength: string;
  dosage: string;
  durationDays: string;
  quantity: string;
  instructions: string;
  product: CatalogHit | null;
};

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  medicine: '',
  strength: '',
  dosage: '',
  durationDays: '',
  quantity: '',
  instructions: '',
  product: null,
});

/** Medicine name with a live look at the attached pharmacy's shelf. */
function MedicineField({
  clinicId,
  hasPharmacy,
  line,
  onChange,
}: {
  clinicId: string;
  hasPharmacy: boolean;
  line: Line;
  onChange: (patch: Partial<Line>) => void;
}) {
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function type(value: string) {
    onChange({ medicine: value, product: null });
    if (!hasPharmacy) return;
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      searchClinicCatalog(clinicId, value)
        .then((list) => {
          setHits(list);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 250);
  }

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
        Medicine
        <input
          required
          minLength={2}
          value={line.medicine}
          onChange={(e) => type(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={hasPharmacy ? 'Search the pharmacy shelf or type a name' : 'e.g. Amoxicillin'}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          autoComplete="off"
          className="input mt-1 w-full"
        />
      </label>
      {line.product && (
        <p className="mt-1 flex items-center gap-1 text-xs text-brand-700 dark:text-brand-300">
          <CheckCircleIcon aria-hidden className="h-4 w-4" />
          On the shelf: {line.product.stock} in stock · {money(line.product.price)}
        </p>
      )}
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {hits.map((hit) => (
            <li key={hit.id} role="option" aria-selected={line.product?.id === hit.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ medicine: hit.name, product: hit });
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-950/40"
              >
                <span className="min-w-0 truncate font-medium text-slate-900 dark:text-slate-50">{hit.name}</span>
                <span
                  className={`shrink-0 text-xs font-semibold ${hit.stock > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}
                >
                  {hit.stock > 0 ? `${hit.stock} in stock` : 'Out of stock'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PrescriptionWriter({
  clinic,
  onIssued,
}: {
  clinic: MyClinic;
  onIssued?: (rx: EPrescription) => void;
}) {
  const presetsId = useId();
  const [contact, setContact] = useState('');
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<{ id: string; name: string } | null>(null);
  const [lookedUp, setLookedUp] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const pharmacy = clinic.pharmacy?.approved ? clinic.pharmacy : null;
  const [sendNow, setSendNow] = useState(Boolean(pharmacy));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<EPrescription | null>(null);

  async function findPatient() {
    if (contact.trim().length < 3) return;
    setSearching(true);
    setError('');
    try {
      const found = await lookupPatient(clinic.id, contact.trim());
      setMatch(found);
      setLookedUp(true);
      if (found) setPatientName(found.name);
      if (!found && /\d{6,}/.test(contact.replace(/\D/g, ''))) setPatientPhone(contact.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search for the patient.');
    } finally {
      setSearching(false);
    }
  }

  function update(key: number, patch: Partial<Line>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const unnamed = lines.findIndex(
      (l) => !l.medicine.trim() && (l.dosage.trim() || l.quantity || l.strength.trim() || l.instructions.trim()),
    );
    if (unnamed >= 0) return setError(`Add the name of medicine ${unnamed + 1}, or remove it.`);
    const items = lines.filter((l) => l.medicine.trim());
    if (!patientName.trim()) return setError("Add the patient's name.");
    if (!items.length) return setError('Add at least one medicine.');
    const missing = items.find((l) => !l.dosage.trim() || !Number(l.quantity));
    if (missing) return setError(`Add the dose and quantity for ${missing.medicine}.`);
    setBusy(true);
    try {
      const rx = await issuePrescription(clinic.id, {
        patientUserId: match?.id,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim() || undefined,
        patientAge: patientAge ? Number(patientAge) : undefined,
        notesForPharmacist: notes.trim() || undefined,
        sendToPharmacy: Boolean(pharmacy && sendNow),
        items: items.map((l) => ({
          medicine: l.medicine.trim(),
          strength: l.strength.trim() || undefined,
          dosage: l.dosage.trim(),
          durationDays: l.durationDays ? Number(l.durationDays) : undefined,
          quantity: Number(l.quantity),
          instructions: l.instructions.trim() || undefined,
          productId: l.product?.id,
        })),
      });
      setIssued(rx);
      onIssued?.(rx);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue the prescription.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setIssued(null);
    setContact('');
    setMatch(null);
    setLookedUp(false);
    setPatientName('');
    setPatientPhone('');
    setPatientAge('');
    setLines([blankLine()]);
    setNotes('');
    setSendNow(Boolean(pharmacy));
  }

  if (issued)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <CheckCircleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {issued.status === 'sent'
              ? `Sent to ${issued.pharmacy?.name}. They're getting it ready now.`
              : 'Prescription issued.'}{' '}
            {issued.hasPatientAccount
              ? 'The patient has it in their LIBERIA360 app.'
              : 'Print it or let the patient photograph the QR code.'}
          </span>
        </p>
        <EPrescriptionCard rx={issued} printable>
          <button type="button" onClick={reset} className="btn-primary min-h-10">
            Write another
          </button>
        </EPrescriptionCard>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-bold text-slate-900 dark:text-slate-50">Patient</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Find their LIBERIA360 account by phone or email
            <input
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                setLookedUp(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void findPatient();
                }
              }}
              placeholder="0886 123 456 or name@example.com"
              className="input mt-1 w-full"
            />
          </label>
          <button
            type="button"
            onClick={() => void findPatient()}
            disabled={searching || contact.trim().length < 3}
            className="btn-secondary min-h-11 gap-1.5 self-end"
          >
            <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
            {searching ? 'Searching…' : 'Find'}
          </button>
        </div>
        {lookedUp && (
          <p className={`mt-2 flex items-center gap-1.5 text-sm ${match ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>
            <UserIcon aria-hidden className="h-4 w-4" />
            {match
              ? `${match.name} has an account. The prescription goes to their app.`
              : 'No account found. They can still use the printed QR code at any pharmacy.'}
          </p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-[1fr_1fr_6rem]">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Full name
            <input required minLength={2} value={patientName} onChange={(e) => setPatientName(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Phone (optional)
            <input type="tel" inputMode="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Age
            <input type="number" min={0} max={130} inputMode="numeric" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} className="input mt-1 w-full" />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">Medicines</legend>
        <datalist id={presetsId}>
          {DOSAGE_PRESETS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        {lines.map((line, index) => {
          const suggestion = suggestedQuantity(line.dosage, Number(line.durationDays) || undefined);
          return (
            <div key={line.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Medicine {index + 1}</span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                    aria-label={`Remove medicine ${index + 1}`}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <TrashIcon aria-hidden className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-[1fr_8rem]">
                <MedicineField clinicId={clinic.id} hasPharmacy={Boolean(pharmacy)} line={line} onChange={(p) => update(line.key, p)} />
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Strength
                  <input value={line.strength} onChange={(e) => update(line.key, { strength: e.target.value })} placeholder="500mg" className="input mt-1 w-full" />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 min-[480px]:col-span-2">
                  Dose
                  <input
                    list={presetsId}
                    value={line.dosage}
                    onChange={(e) => update(line.key, { dosage: e.target.value })}
                    placeholder="1 tablet 3 times a day"
                    className="input mt-1 w-full"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 min-[480px]:grid-cols-[7rem_7rem_1fr]">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Days
                  <input type="number" min={1} max={365} inputMode="numeric" value={line.durationDays} onChange={(e) => update(line.key, { durationDays: e.target.value })} className="input mt-1 w-full" />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Quantity
                  <input type="number" min={1} max={1000} inputMode="numeric" value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} className="input mt-1 w-full" />
                </label>
                <label className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300 min-[480px]:col-span-1">
                  Instructions (optional)
                  <input value={line.instructions} onChange={(e) => update(line.key, { instructions: e.target.value })} placeholder="Take with food" className="input mt-1 w-full" />
                </label>
              </div>
              {suggestion && String(suggestion) !== line.quantity && (
                <button
                  type="button"
                  onClick={() => update(line.key, { quantity: String(suggestion) })}
                  className="mt-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-200"
                >
                  Full course: {suggestion}
                </button>
              )}
              {line.product && Number(line.quantity) > line.product.stock && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {pharmacy?.name} only has {line.product.stock}. The patient may need another pharmacy for the rest.
                </p>
              )}
            </div>
          );
        })}
        {lines.length < 12 && (
          <button type="button" onClick={() => setLines((all) => [...all, blankLine()])} className="btn-secondary min-h-10 gap-1.5 self-start">
            <PlusIcon aria-hidden className="h-4 w-4" /> Add medicine
          </button>
        )}
      </fieldset>

      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Note for the pharmacist (optional)
        <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Child struggles with tablets, syrup preferred" className="input mt-1 w-full" />
      </label>

      {pharmacy ? (
        <label className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-50">
          <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="mt-0.5 h-5 w-5" />
          <span>
            <span className="block font-semibold">Send to {pharmacy.name} now</span>
            They start packing it straight away, so it&apos;s ready when the patient walks over.
          </span>
        </label>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The patient can fill this at any pharmacy on LIBERIA360, or show the QR code at the counter.
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Controlled medicines (e.g. tramadol, diazepam, morphine) can&apos;t be prescribed here. Valid for 30 days and can be dispensed only once.
      </p>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn-primary min-h-12 text-base">
        {busy ? 'Issuing…' : 'Issue prescription'}
      </button>
    </form>
  );
}
