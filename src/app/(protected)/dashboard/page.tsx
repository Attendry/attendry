import { CommandCentre } from '@/components/command-centre/CommandCentre';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <CommandCentre />
      </div>
    </div>
  );
}


