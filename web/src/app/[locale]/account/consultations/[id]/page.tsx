'use client';

import { use } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { ConsultationRoom } from '@/components/consultations/ConsultationRoom';

export default function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SignedInGate title="Consultation" reason="Log in to see your consultation.">
      <ConsultationRoom id={id} as="patient" />
    </SignedInGate>
  );
}
