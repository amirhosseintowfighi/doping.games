import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import AuthForm from '@/src/views/AuthForm.jsx';

export const metadata: Metadata = { title: 'ورود | دوپینگ', robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/panel');
  return <AuthForm mode="login" next={next} />;
}
