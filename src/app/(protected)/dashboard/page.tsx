import { SimplifiedDashboard } from '@/components/dashboard/SimplifiedDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <SimplifiedDashboard />
      </div>
    </div>
  );
}


