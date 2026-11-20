import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { panelData } from '@/lib/server/panel';
import UserPanel from '@/src/views/UserPanel.jsx';

export const metadata: Metadata = { title: 'پنل گیمر | دوپینگ', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function Panel({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/panel');
  const { tab } = await searchParams;
  return <UserPanel initial={await panelData(user)} tab={tab} />;
}
