import type { Metadata } from 'next';
import { channels } from '@/lib/server/messaging';
import { ForgotForm } from '@/src/views/AuthForm.jsx';

export const metadata: Metadata = { title: 'بازیابی رمز | دوپینگ', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function Forgot() {
  return <ForgotForm email={channels.email()} />;
}
