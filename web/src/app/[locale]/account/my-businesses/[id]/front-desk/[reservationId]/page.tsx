'use client';

import { useParams } from 'next/navigation';
import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { DeskReservation } from '@/components/stays/DeskReservation';

export default function FrontDeskReservationPage() {
  const { business } = useBusinessDashboard();
  const { reservationId } = useParams<{ reservationId: string }>();
  return <DeskReservation businessId={business.id} id={reservationId} />;
}
