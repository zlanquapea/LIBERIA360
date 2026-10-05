'use client';

import { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { TripDeskBoard } from '@/components/group-trips/TripDeskBoard';

function Desk({ id }: { id: string }) {
  const focus = useSearchParams().get('booking');
  return <TripDeskBoard tripId={id} focusBooking={focus} />;
}

export default function TripHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SignedInGate title="Trip desk" reason="Log in to run your trip's bookings.">
      <Suspense fallback={null}>
        <Desk id={id} />
      </Suspense>
    </SignedInGate>
  );
}
