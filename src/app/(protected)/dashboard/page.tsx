import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import { CommandCentre } from '@/components/command-centre/CommandCentre';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-4xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Command Centre"
            description="Log in to access your outreach cockpit with targeted speakers, account intelligence, and live market signals."
          />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8">
        {session && <CommandCentre />}
      </div>
    </div>
  );
}


