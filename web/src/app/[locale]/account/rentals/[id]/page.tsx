'use client';

import { use } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { RenterTrip } from '@/components/rentals/RenterTrip';

export default function RentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SignedInGate title="Your rental" reason="Log in to see your car rental.">
      <RenterTrip id={id} />
    </SignedInGate>
  );
}
