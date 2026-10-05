import Link from 'next/link';
import type { Metadata } from 'next';
import { BuildingOffice2Icon, MapPinIcon } from '@heroicons/react/24/outline';
import { DoctorChip } from '@/components/prescriptions/DoctorChip';
import { HowEPrescriptionsWork } from '@/components/prescriptions/HowEPrescriptionsWork';
import { getClinics, type PublicClinic } from '@/lib/clinic-api';

export const metadata: Metadata = {
  title: 'Partner clinics and e-prescriptions | LIBERIA360',
  description:
    'Verified clinics and licensed doctors in Liberia. Get your prescription on your phone and collect it from the pharmacy, ready when you walk out.',
};

export default async function ClinicsPage() {
  const clinics: PublicClinic[] = await getClinics().catch(() => []);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-800 via-brand-900 to-slate-950 p-6 text-white sm:p-10">
        <span aria-hidden className="absolute -end-6 -top-10 -z-10 font-serif text-[12rem] font-black italic leading-none opacity-[0.08]">
          ℞
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">Health</p>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          See a verified doctor. Walk out with your medicine.
        </h1>
        <p className="mt-3 max-w-xl text-white/80">
          Partner clinics write prescriptions straight to your phone and their pharmacy, so your medicine is
          ready by the time you reach the counter.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/consult" className="rounded-full bg-gold-300 px-5 py-2.5 text-sm font-bold text-brand-950 hover:bg-gold-200">
            Talk to a doctor online
          </Link>
          <Link href="/account/prescriptions" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-inset ring-white/30 hover:bg-white/20">
            My prescriptions
          </Link>
          <Link href="/pharmacies" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-inset ring-white/30 hover:bg-white/20">
            Find a pharmacy
          </Link>
        </div>
      </header>

      <HowEPrescriptionsWork />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Partner clinics</h2>
        {clinics.length === 0 && (
          <p className="empty-state">
            Partner clinics are joining soon. Run a clinic?{' '}
            <Link href="/account/clinic-dashboard" className="font-semibold text-brand-700 underline">
              Register it
            </Link>
            .
          </p>
        )}
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clinics.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clinics/${c.slug}`}
                className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                    <BuildingOffice2Icon aria-hidden className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words font-display text-lg font-bold text-slate-950 dark:text-slate-50">{c.name}</span>
                    <span className="flex items-start gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <MapPinIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                      {c.address}, {c.location}
                    </span>
                  </span>
                </div>
                {c.doctors.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {c.doctors.slice(0, 2).map((d) => (
                      <DoctorChip key={d.id} doctor={d} />
                    ))}
                    {c.doctors.length > 2 && <span className="text-xs text-slate-500">+{c.doctors.length - 2} more doctors</span>}
                  </div>
                )}
                {c.pharmacy && (
                  <span className="mt-auto self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    Pharmacy on site: {c.pharmacy.name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
