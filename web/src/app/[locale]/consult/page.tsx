import type { Metadata } from 'next';
import { ConsultDirectory } from '@/components/consultations/ConsultDirectory';

export const metadata: Metadata = {
  title: 'Talk to a doctor online | LIBERIA360',
  description:
    'Chat or send voice notes to a licensed Liberian doctor. Pay by MTN MoMo or Orange Money, and get your prescription on your phone.',
};

export default function ConsultPage() {
  return <ConsultDirectory />;
}
