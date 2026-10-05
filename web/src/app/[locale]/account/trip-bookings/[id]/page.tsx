'use client';

import { use } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { TripTicket } from '@/components/group-trips/TripTicket';

export default function TripBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SignedInGate title="Your trip ticket" reason="Log in to see your trip booking.">
      <TripTicket id={id} />
    </SignedInGate>
  );
}
