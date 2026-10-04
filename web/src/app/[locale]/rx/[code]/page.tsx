import type { Metadata } from 'next';
import { RxVerify } from '@/components/prescriptions/RxVerify';

export const metadata: Metadata = {
  title: 'Check a prescription',
  robots: { index: false, follow: false },
};

export default async function RxVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code } = await params;
  const { t } = await searchParams;
  return <RxVerify code={decodeURIComponent(code)} token={typeof t === 'string' ? t : null} />;
}
