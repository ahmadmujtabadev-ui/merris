'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { SectionLabel } from '@/components/merris/label';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const PROTOTYPE_PROFILE = {
  name: 'Alex Thorne',
  email: 'alex.thorne@merris.ai',
  organisation: 'Merris Sovereign Intel',
  role: 'Chief Analyst',
  jurisdiction: 'EU (SFDR/CSRD)',
  timezone: '(GMT+03:00) AST',
};

interface TeamMember {
  id?: string;
  name: string;
  role: string;
  status: 'Active' | 'Pending';
}

const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Alex Thorne',  role: 'Admin',         status: 'Active' },
  { name: 'Elena Vance',  role: 'Lead Analyst',  status: 'Active' },
  { name: 'David Chen',   role: 'Data Analyst',  status: 'Active' },
  { name: 'Sana Khan',    role: 'Field Auditor', status: 'Pending' },
];

interface PreferencesData {
  primarySector: string;
  language: string;
  notifications: string;
}

const PREFERENCES_FALLBACK: PreferencesData = {
  primarySector: 'Renewable Energy',
  language: 'EN / AR',
  notifications: 'Email + Dashboard',
};

interface BillingData {
  plan: string;
  computeCredits: string;
  nextRenewal: string;
  paymentLast4: string;
}

const BILLING_FALLBACK: BillingData = {
  plan: 'Merris Enterprise',
  computeCredits: '12,450 / 50k',
  nextRenewal: 'Oct 12, 2026',
  paymentLast4: '4242',
};

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

function StatusPill({ seeded }: { seeded: boolean }) {
  return seeded ? (
    <Pill variant="completed" size="sm">📡 Live</Pill>
  ) : (
    <Pill variant="draft" size="sm">📋 Placeholder</Pill>
  );
}

function TeamCard({ team, seeded }: { team: TeamMember[]; seeded: boolean }) {
  return (
    <MerrisCard className="mb-5">
      <div className="mb-2 flex justify-end">
        <StatusPill seeded={seeded} />
      </div>
      {team.map((m) => (
        <div key={m.id ?? m.name} className="flex items-center gap-2.5 border-b border-merris-border py-2.5 last:border-b-0">
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

function PreferencesCard({ preferences, seeded }: { preferences: PreferencesData; seeded: boolean }) {
  const rows = [
    { label: 'Primary Sector', value: preferences.primarySector },
    { label: 'Language',       value: preferences.language },
    { label: 'Notifications',  value: preferences.notifications },
  ];
  return (
    <MerrisCard className="bg-merris-surface-low">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Preferences</SectionLabel>
        <StatusPill seeded={seeded} />
      </div>
      {rows.map((p) => (
        <div key={p.label} className="mb-2">
          <div className="font-body text-[9px] uppercase text-merris-text-tertiary">{p.label}</div>
          <div className="font-body text-[12px] text-merris-text">{p.value}</div>
        </div>
      ))}
    </MerrisCard>
  );
}

function BillingCard({ billing, seeded }: { billing: BillingData; seeded: boolean }) {
  const rows = [
    { label: 'Compute Credits', value: billing.computeCredits },
    { label: 'Next Renewal',    value: billing.nextRenewal },
    { label: 'Payment',         value: `•••• ${billing.paymentLast4}` },
  ];
  return (
    <MerrisCard className="bg-merris-surface-low">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Billing</SectionLabel>
        <StatusPill seeded={seeded} />
      </div>
      <div className="mb-1 font-body text-[12px] text-merris-text-tertiary">Active Plan</div>
      <div className="mb-2.5 font-display text-[16px] font-bold text-merris-text">{billing.plan}</div>
      {rows.map((b) => (
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
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const [team, setTeam] = useState<TeamMember[]>(TEAM_MEMBERS);
  const [teamSeeded, setTeamSeeded] = useState(false);

  const [preferences, setPreferences] = useState<PreferencesData>(PREFERENCES_FALLBACK);
  const [preferencesSeeded, setPreferencesSeeded] = useState(false);

  const [billing, setBilling] = useState<BillingData>(BILLING_FALLBACK);
  const [billingSeeded, setBillingSeeded] = useState(false);

  useEffect(() => {
    api
      .getTeam()
      .then((res) => {
        setTeam(res.members);
        setTeamSeeded(res.seeded);
      })
      .catch(() => {
        // Fall back to constants — already set
      });

    api
      .getPreferences()
      .then((res) => {
        setPreferences(res.preferences);
        setPreferencesSeeded(res.seeded);
      })
      .catch(() => {
        // Fall back to constants — already set
      });

    api
      .getBilling()
      .then((res) => {
        setBilling(res.billing);
        setBillingSeeded(res.seeded);
      })
      .catch(() => {
        // Fall back to constants — already set
      });
  }, []);

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
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="mb-1 font-display text-[20px] font-bold text-merris-text">
              {tab === 'Profile' ? 'Profile & Organisation' : tab}
            </h1>
            <p className="font-body text-[12px] text-merris-text-secondary">
              {tab === 'Profile' && 'Manage your identity across the Merris ecosystem.'}
              {tab === 'Team' && 'Team members with access to this workspace.'}
              {tab === 'Preferences' && 'Configure how Merris adapts to your work.'}
              {tab === 'Billing' && 'Plan, usage, and payment details.'}
            </p>
          </div>
          {tab === 'Profile' && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-merris-sm border border-merris-error px-3 py-1.5 font-body text-[11px] font-semibold text-merris-error hover:bg-merris-error-bg"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          )}
        </div>

        {tab === 'Profile' && (
          <>
            <ProfileForm />
            <h2 className="mb-2.5 font-display text-[16px] font-semibold text-merris-text">Team Management</h2>
            <TeamCard team={team} seeded={teamSeeded} />
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <PreferencesCard preferences={preferences} seeded={preferencesSeeded} />
              <BillingCard billing={billing} seeded={billingSeeded} />
            </div>
          </>
        )}

        {tab === 'Team' && <TeamCard team={team} seeded={teamSeeded} />}
        {tab === 'Preferences' && <PreferencesCard preferences={preferences} seeded={preferencesSeeded} />}
        {tab === 'Billing' && <BillingCard billing={billing} seeded={billingSeeded} />}
      </main>
    </div>
  );
}
