import { BookConsultation } from '@/components/consultations/BookConsultation';

export default async function BookConsultationPage({ params }: { params: Promise<{ doctorId: string }> }) {
  const { doctorId } = await params;
  return <BookConsultation doctorId={doctorId} />;
}
