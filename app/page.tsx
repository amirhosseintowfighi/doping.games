import { publicServers, publicStats } from '@/lib/server/panel';
import Storefront from '@/src/views/Storefront.jsx';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [servers, stats] = await Promise.all([publicServers(), publicStats()]);
  return <Storefront servers={servers} stats={stats} />;
}
