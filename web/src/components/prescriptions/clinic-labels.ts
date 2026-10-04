import type { ClinicStaffRole, ClinicStatus, DoctorVerificationStatus } from '@/lib/clinic-api';

export const CLINIC_STATUS_STYLES: Record<ClinicStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
};

export const CLINIC_ROLE_LABELS: Record<ClinicStaffRole, string> = {
  admin: 'Clinic admin',
  doctor: 'Doctor',
  front_desk: 'Front desk',
};

export const DOCTOR_STATUS_COPY: Record<DoctorVerificationStatus, { label: string; style: string }> = {
  pending: {
    label: 'Licence being checked',
    style: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  },
  verified: {
    label: 'Licence verified',
    style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  rejected: {
    label: 'Licence not verified',
    style: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
  },
};
