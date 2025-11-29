"use client";

import { AgentDashboardPanel } from "@/components/agents/AgentDashboardPanel";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function AgentManagementSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="AI Agent Management"
          subtitle="Manage your AI agent team for automated outreach and follow-up"
          breadcrumbs={[
            { label: "Settings", href: "/settings" },
            { label: "Agents" }
          ]}
        />
        
        <div className="mt-8">
          <AgentDashboardPanel />
        </div>
      </div>
    </div>
  );
}

