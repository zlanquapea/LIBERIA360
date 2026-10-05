'use client';

import { use } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { GuestStay } from '@/components/stays/GuestStay';

export default function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SignedInGate title="Your stay" reason="Log in to see your booking.">
      <GuestStay id={id} />
    </SignedInGate>
  );
}
