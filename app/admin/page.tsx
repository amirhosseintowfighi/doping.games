import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { adminOverview } from '@/lib/server/panel';
import Admin from '@/src/views/Admin.jsx';

export const metadata: Metadata = { title: 'مدیریت | دوپینگ', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin' && user.role !== 'support') notFound();
  return <Admin initial={await adminOverview()} role={user.role} />;
}
