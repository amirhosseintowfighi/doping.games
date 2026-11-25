import type { Metadata } from 'next';
import { ResetForm } from '@/src/views/AuthForm.jsx';

export const metadata: Metadata = { title: 'رمز جدید | دوپینگ', robots: { index: false }, referrer: 'no-referrer' };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : ''} />;
}
