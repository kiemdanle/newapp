import { serverAdminApi } from '@/lib/admin-api';
import { ExternalApisDashboard } from './components/external-apis-dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    range?: '24h' | '7d' | '30d';
  }>;
}

export default async function SystemExternalApisPage({ searchParams }: PageProps) {
  const { range: rawRange } = await searchParams;
  const range: '24h' | '7d' | '30d' =
    rawRange === '7d' || rawRange === '30d' ? rawRange : '24h';

  const [stats, requests] = await Promise.all([
    serverAdminApi.system.barcodeApiStats(range),
    serverAdminApi.system.barcodeApiRequests({ range, limit: 50 }),
  ]);

  return (
    <ExternalApisDashboard
      stats={stats}
      requests={requests}
      range={range}
    />
  );
}
