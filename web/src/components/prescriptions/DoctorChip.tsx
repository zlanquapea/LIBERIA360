import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import type { PublicDoctor } from '@/lib/clinic-api';

export function doctorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function DoctorChip({ doctor, detailed = false }: { doctor: PublicDoctor; detailed?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-black text-brand-800 dark:bg-brand-950 dark:text-brand-200">
        {doctorInitials(doctor.fullName)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-50">
          <span className="truncate">Dr {doctor.fullName}</span>
          {doctor.verified && <CheckBadgeIcon aria-label="Licence verified" className="h-4 w-4 shrink-0 text-brand-600" />}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {doctor.specialty}
          {detailed && ` · Licence ${doctor.licenceNumber}`}
        </span>
        {detailed && doctor.bio && <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{doctor.bio}</span>}
      </span>
    </div>
  );
}
