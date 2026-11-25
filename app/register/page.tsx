import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { env } from '@/lib/server/env';
import AuthForm from '@/src/views/AuthForm.jsx';

export const metadata: Metadata = { title: 'ثبت‌نام | دوپینگ', robots: { index: false } };

export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string }> }) {
  const { next, ref } = await searchParams;
  if (await currentUser()) redirect('/panel');
  return <AuthForm mode="register" next={next} registration={env.registration} refCode={/^[A-Za-z0-9]{6,12}$/.test(ref ?? '') ? ref!.toUpperCase() : ''} />;
}
