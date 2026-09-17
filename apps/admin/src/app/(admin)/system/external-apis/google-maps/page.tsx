import { serverAdminApi } from '@/lib/admin-api';
import { GoogleMapsDashboard } from './components/google-maps-dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    timeRange?: '24h' | '7d' | '30d';
    page?: string;
    status?: 'all' | 'success' | 'cached' | 'error';
  }>;
}

export default async function GoogleMapsAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const timeRange = params.timeRange === '24h' || params.timeRange === '30d' ? params.timeRange : '7d';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const status = params.status || 'all';

  const summary = await serverAdminApi.system.googleMapsStats({
    timeRange,
    page,
    status: status as 'all' | 'success' | 'cached' | 'error',
    limit: 25,
  });

  return (
    <GoogleMapsDashboard summary={summary} timeRange={timeRange} page={page} status={status} />
  );
}
