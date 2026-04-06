'use client';

import { useState } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { SectionLabel } from '@/components/merris/label';
import { useAuthStore } from '@/lib/store';

const PROTOTYPE_PROFILE = {
  name: 'Alex Thorne',
  email: 'alex.thorne@merris.ai',
  organisation: 'Merris Sovereign Intel',
  role: 'Chief Analyst',
  jurisdiction: 'EU (SFDR/CSRD)',
  timezone: '(GMT+03:00) AST',
};

const TEAM_MEMBERS = [
  { name: 'Alex Thorne',  role: 'Admin',         status: 'Active' as const },
  { name: 'Elena Vance',  role: 'Lead Analyst',  status: 'Active' as const },
  { name: 'David Chen',   role: 'Data Analyst',  status: 'Active' as const },
  { name: 'Sana Khan',    role: 'Field Auditor', status: 'Pending' as const },
];

const TABS = ['Profile', 'Team', 'Preferences', 'Billing'] as const;
type Tab = (typeof TABS)[number];

function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);

  // Compose from auth store with prototype fallbacks
  const fields = [
    { label: 'Full Name',     value: user?.name ?? PROTOTYPE_PROFILE.name },
    { label: 'Email',         value: user?.email ?? PROTOTYPE_PROFILE.email },
    { label: 'Organisation',  value: org?.name ?? PROTOTYPE_PROFILE.organisation },
    { label: 'Role',          value: user?.role ?? PROTOTYPE_PROFILE.role },
    { label: 'Jurisdiction',  value: PROTOTYPE_PROFILE.jurisdiction },
    { label: 'Timezone',      value: PROTOTYPE_PROFILE.timezone },
  ];

  return (
    <MerrisCard className="mb-5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label}>
            <div className="mb-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{f.label}</div>
            <div className="rounded-merris-sm bg-merris-surface-low px-2.5 py-1.5 font-body text-[12px] text-merris-text">{f.value}</div>
          </div>
        ))}
      </div>
    </MerrisCard>
  );
}

function TeamCard() {
  return (
    <MerrisCard className="mb-5">
      {TEAM_MEMBERS.map((m) => (
        <div key={m.name} className="flex items-center gap-2.5 border-b border-merris-border py-2.5 last:border-b-0">
          <div className="h-7 w-7 rounded-full bg-merris-surface-low" />
          <div className="flex-1 font-display text-[12px] font-medium text-merris-text">{m.name}</div>
          <span className="rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-secondary">{m.role}</span>
          <Pill variant={m.status === 'Active' ? 'completed' : 'in-progress'} size="sm">
            {m.status}
          </Pill>
        </div>
      ))}
      <div className="mt-3">
        <MerrisButton variant="secondary">+ Invite Member</MerrisButton>
      </div>
    </MerrisCard>
  );
}

function PreferencesCard() {
  return (
    <MerrisCard className="bg-merris-surface-low">
      <SectionLabel>Preferences</SectionLabel>
      {[
        { label: 'Primary Sector', value: 'Renewable Energy' },
        { label: 'Language',       value: 'EN / AR' },
        { label: 'Notifications',  value: 'Email + Dashboard' },
      ].map((p) => (
        <div key={p.label} className="mb-2">
          <div className="font-body text-[9px] uppercase text-merris-text-tertiary">{p.label}</div>
          <div className="font-body text-[12px] text-merris-text">{p.value}</div>
        </div>
      ))}
    </MerrisCard>
  );
}

function BillingCard() {
  return (
    <MerrisCard className="bg-merris-surface-low">
      <SectionLabel>Billing</SectionLabel>
      <div className="mb-1 font-body text-[12px] text-merris-text-tertiary">Active Plan</div>
      <div className="mb-2.5 font-display text-[16px] font-bold text-merris-text">Merris Enterprise</div>
      {[
        { label: 'Compute Credits', value: '12,450 / 50k' },
        { label: 'Next Renewal',    value: 'Oct 12, 2026' },
        { label: 'Payment',         value: '•••• 4242' },
      ].map((b) => (
        <div key={b.label} className="flex justify-between border-t border-merris-border py-1 font-body text-[11px]">
          <span className="text-merris-text-tertiary">{b.label}</span>
          <span className="font-medium text-merris-text">{b.value}</span>
        </div>
      ))}
    </MerrisCard>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Profile');

  return (
    <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[160px_1fr]">
      <aside>
        <SectionLabel>Configuration</SectionLabel>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`mb-0.5 block w-full rounded-merris-sm px-2.5 py-1.5 text-left font-display text-[12px] ${
              tab === t
                ? 'bg-merris-primary-bg font-semibold text-merris-primary'
                : 'text-merris-text-secondary hover:bg-merris-surface-low'
            }`}
          >
            {t}
          </button>
        ))}
      </aside>
      <main>
        <h1 className="mb-1 font-display text-[20px] font-bold text-merris-text">
          {tab === 'Profile' ? 'Profile & Organisation' : tab}
        </h1>
        <p className="mb-5 font-body text-[12px] text-merris-text-secondary">
          {tab === 'Profile' && 'Manage your identity across the Merris ecosystem.'}
          {tab === 'Team' && 'Team members with access to this workspace.'}
          {tab === 'Preferences' && 'Configure how Merris adapts to your work.'}
          {tab === 'Billing' && 'Plan, usage, and payment details.'}
        </p>

        {tab === 'Profile' && (
          <>
            <ProfileForm />
            <h2 className="mb-2.5 font-display text-[16px] font-semibold text-merris-text">Team Management</h2>
            <TeamCard />
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <PreferencesCard />
              <BillingCard />
            </div>
          </>
        )}

        {tab === 'Team' && <TeamCard />}
        {tab === 'Preferences' && <PreferencesCard />}
        {tab === 'Billing' && <BillingCard />}
      </main>
    </div>
  );
}
