'use client';

import { useState, useEffect, type ReactNode } from 'react';
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

const TABS = ['Profile', 'Team', 'Preferences', 'Billing', 'Add-ins'] as const;
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

// ── Add-ins onboarding ─────────────────────────────────────────

interface AddinInfo {
  name: string;
  host: string;
  icon: ReactNode;
  color: string;
  manifestFile: string;
  features: string[];
  tabs: string[];
}

const ADDIN_LIST: AddinInfo[] = [
  {
    name: 'Word',
    host: 'Microsoft Word',
    color: '#2b5797',
    manifestFile: 'manifest.xml',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    features: [
      'Insert workflow run output at cursor, end, or as comment',
      'Chat with the ESG agent using document context',
      'Quick Check and Full Review of the open document',
      'Verify document against compliance frameworks',
    ],
    tabs: ['Insert', 'Chat', 'Review', 'History'],
  },
  {
    name: 'Excel',
    host: 'Microsoft Excel',
    color: '#1d6f42',
    manifestFile: 'manifest.xml',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
      </svg>
    ),
    features: [
      'Browse and select engagement data points as a checklist',
      'Insert selected metrics as a formatted table or list',
      'Auto-fill cells from the AI agent',
      'Validate the active sheet and highlight anomalies',
    ],
    tabs: ['Data', 'Insert', 'Validate'],
  },
  {
    name: 'PowerPoint',
    host: 'Microsoft PowerPoint',
    color: '#b7472a',
    manifestFile: 'manifest.xml',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M8 12h8M12 9v6"/>
      </svg>
    ),
    features: [
      'Insert workflow run output as title or content slides',
      'Insert ESG metric charts (bar, line, pie, waterfall)',
      'Apply Merris or custom brand colours and fonts',
    ],
    tabs: ['Slides', 'Chart', 'Brand'],
  },
];

const SIDELOAD_STEPS = [
  { label: 'Open the Office app (Word / Excel / PowerPoint).', icon: '1' },
  { label: 'Go to Insert → Add-ins → My Add-ins → Manage My Add-ins → Upload My Add-in.', icon: '2' },
  { label: 'Browse to the manifest file in apps/office-addins/<host>/manifest.xml and click Upload.', icon: '3' },
  { label: 'The Merris ESG panel will appear in the Home ribbon.', icon: '4' },
];

function AddinsTab() {
  return (
    <div className="space-y-6">
      {/* Sideloading instructions */}
      <MerrisCard>
        <div className="mb-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b5142" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-merris-primary">How to sideload</div>
        </div>
        <div className="space-y-2">
          {SIDELOAD_STEPS.map((step) => (
            <div key={step.icon} className="flex items-start gap-3">
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-merris-primary-bg font-body text-[10px] font-bold text-merris-primary">
                {step.icon}
              </div>
              <p className="font-body text-[12px] text-merris-text-secondary">{step.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-merris-sm border border-amber-200 bg-amber-50 px-3 py-2 font-body text-[11px] text-amber-700">
          <strong>Note:</strong> Sideloading requires an Office 365 / Microsoft 365 subscription. On Mac, use Insert → Add-ins → Upload My Add-in from the More Options menu.
        </div>
      </MerrisCard>

      {/* Per-add-in cards */}
      {ADDIN_LIST.map((addin) => (
        <MerrisCard key={addin.name}>
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-merris-sm text-white"
              style={{ background: addin.color }}
            >
              {addin.icon}
            </div>
            <div>
              <div className="font-display text-[14px] font-bold text-merris-text">Merris ESG — {addin.name}</div>
              <div className="font-body text-[11px] text-merris-text-secondary">{addin.host} task pane</div>
            </div>
            <div className="ml-auto flex gap-1.5">
              {addin.tabs.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-merris-primary-bg px-2 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-primary"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Features</div>
            <ul className="space-y-1">
              {addin.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="mt-0.5 flex-shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0b5142" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="font-body text-[12px] text-merris-text-secondary">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-merris-sm border border-merris-border bg-merris-surface-low px-2.5 py-1.5 font-body text-[11px] text-merris-text-secondary">
              <span className="font-semibold text-merris-text">Manifest: </span>
              apps/office-addins/{addin.name.toLowerCase()}/{addin.manifestFile}
            </div>
          </div>
        </MerrisCard>
      ))}
    </div>
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
              {tab === 'Profile' ? 'Profile & Organisation' : tab === 'Add-ins' ? 'Office Add-ins' : tab}
            </h1>
            <p className="font-body text-[12px] text-merris-text-secondary">
              {tab === 'Profile' && 'Manage your identity across the Merris ecosystem.'}
              {tab === 'Team' && 'Team members with access to this workspace.'}
              {tab === 'Preferences' && 'Configure how Merris adapts to your work.'}
              {tab === 'Billing' && 'Plan, usage, and payment details.'}
              {tab === 'Add-ins' && 'Install and use Merris ESG inside Word, Excel, and PowerPoint.'}
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
        {tab === 'Add-ins' && <AddinsTab />}
      </main>
    </div>
  );
}
