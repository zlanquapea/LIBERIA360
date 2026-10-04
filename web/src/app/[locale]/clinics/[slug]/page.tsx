import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { DoctorChip } from '@/components/prescriptions/DoctorChip';
import { HowEPrescriptionsWork } from '@/components/prescriptions/HowEPrescriptionsWork';
import { getClinic } from '@/lib/clinic-api';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClinic(slug).catch(() => null);
  if (!c) return { title: 'Clinic | LIBERIA360' };
  return {
    title: `${c.name}, ${c.location} | LIBERIA360`,
    description: `${c.name}: verified doctors and e-prescriptions${c.pharmacy ? ` filled at ${c.pharmacy.name}` : ''}.`,
  };
}

export default async function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getClinic(slug).catch(() => null);
  if (!clinic) notFound();
  const tel = clinic.telephone.replace(/\s+/g, '');
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <p className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckBadgeIcon aria-hidden className="h-4 w-4" /> Verified clinic
        </p>
        <h1 className="mt-3 break-words font-display text-3xl font-extrabold text-slate-950 dark:text-slate-50 sm:text-4xl">
          {clinic.name}
        </h1>
        <p className="mt-2 flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
          <MapPinIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          {clinic.address}, {clinic.location}
        </p>
        {clinic.about && <p className="mt-4 whitespace-pre-line text-slate-700 dark:text-slate-200">{clinic.about}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={`tel:${tel}`} className="btn-primary min-h-11 gap-1.5">
            <PhoneIcon aria-hidden className="h-5 w-5" /> Call {clinic.telephone}
          </a>
          {clinic.pharmacy && (
            <Link href={`/pharmacies/${clinic.pharmacy.slug}`} className="btn-secondary min-h-11">
              Visit {clinic.pharmacy.name}
            </Link>
          )}
        </div>
      </header>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">Doctors</h2>
        {clinic.doctors.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Doctor profiles are being verified.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {clinic.doctors.map((d) => (
              <li key={d.id}>
                <DoctorChip doctor={d} detailed />
              </li>
            ))}
          </ul>
        )}
      </section>

      {clinic.pharmacy && (
        <section className="rounded-[2rem] bg-brand-950 p-6 text-white">
          <h2 className="font-display text-xl font-bold">Ready when you walk out</h2>
          <p className="mt-2 text-white/80">
            Doctors here can send your prescription straight to {clinic.pharmacy.name}, so it&apos;s packed before
            you reach the counter. Pay with cash, MTN MoMo or Orange Money.
          </p>
        </section>
      )}

      <HowEPrescriptionsWork />
    </main>
  );
}
