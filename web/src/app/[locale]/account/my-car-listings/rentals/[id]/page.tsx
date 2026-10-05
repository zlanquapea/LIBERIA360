'use client';

import { use } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { OwnerRental } from '@/components/rentals/OwnerRental';

export default function OwnerRentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SignedInGate title="Rental" reason="Log in to manage this rental.">
      <OwnerRental id={id} />
    </SignedInGate>
  );
}
