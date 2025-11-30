'use client';

import { useRouter } from 'next/navigation';
import { Search, Target, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: number;
  primary?: boolean;
}

function QuickActionButton({ 
  icon: Icon, 
  label, 
  onClick, 
  href, 
  badge, 
  primary = false 
}: QuickActionButtonProps) {
  const router = useRouter();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  const buttonContent = (
    <button
      onClick={handleClick}
      className={`
        group relative flex items-center gap-3 rounded-xl border-2 px-6 py-4 text-left transition-all
        ${primary 
          ? 'border-blue-600 bg-blue-600 text-white shadow-lg hover:border-blue-700 hover:bg-blue-700 hover:shadow-xl' 
          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
        }
      `}
    >
      <div className={`
        rounded-lg p-2
        ${primary ? 'bg-white/20' : 'bg-blue-50'}
      `}>
        <Icon className={`h-5 w-5 ${primary ? 'text-white' : 'text-blue-600'}`} />
      </div>
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        {badge !== undefined && badge > 0 && (
          <div className={`text-sm ${primary ? 'text-blue-100' : 'text-slate-500'}`}>
            {badge} {badge === 1 ? 'item' : 'items'}
          </div>
        )}
      </div>
      <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${primary ? 'text-white' : 'text-slate-400'}`} />
      {badge !== undefined && badge > 0 && (
        <span className={`
          absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
          ${primary ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}
        `}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );

  if (href && !onClick) {
    return (
      <Link href={href} className="block">
        {buttonContent}
      </Link>
    );
  }

  return buttonContent;
}

interface DashboardHeaderProps {
  urgentOpportunities?: number;
  readyForOutreach?: number;
}

export function DashboardHeader({ 
  urgentOpportunities = 0, 
  readyForOutreach = 0 
}: DashboardHeaderProps) {
  return (
    <header className="mb-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-900">Home</h1>
        <p className="mt-2 text-slate-600">
          Your command center for event-based sales prospecting
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Find events → See attendees → Warm outreach → Generate opportunities
        </p>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickActionButton
          icon={Search}
          label="Search Events"
          href="/events"
          primary
        />
        <QuickActionButton
          icon={Target}
          label="View Opportunities"
          href="/opportunities"
          badge={urgentOpportunities}
        />
        <QuickActionButton
          icon={Users}
          label="Manage Contacts"
          href="/contacts"
          badge={readyForOutreach}
        />
      </div>
    </header>
  );
}

