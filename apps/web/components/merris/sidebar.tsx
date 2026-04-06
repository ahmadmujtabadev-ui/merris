'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { merrisTokens } from '@/lib/design-tokens';
import { MerrisButton } from './button';

interface NavItem {
  href: string;
  label: string;
  iconPath: string; // raw SVG path data
}

const NAV: NavItem[] = [
  { href: '/intelligence',    label: 'Intelligence',    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3' },
  { href: '/portfolio',       label: 'Portfolio',       iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { href: '/compliance',      label: 'Compliance',      iconPath: 'M9 12l2 2 4-4M3 12a9 9 0 1018 0 9 9 0 00-18 0z' },
  { href: '/knowledge',       label: 'Knowledge',       iconPath: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
  { href: '/firm-library',    label: 'Firm Library',    iconPath: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { href: '/workflow-agents', label: 'Workflow Agents', iconPath: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z' },
  { href: '/history',         label: 'History',         iconPath: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2' },
  { href: '/config',          label: 'AI Config',       iconPath: 'M4 4h16v16H4zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M20 9h3M1 15h3M20 15h3' },
  { href: '/settings',        label: 'Settings',        iconPath: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 1v2M12 21v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4' },
];

function Icon({ d, color }: { d: string; color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function MerrisSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed left-0 top-0 z-[100] flex h-screen w-[192px] flex-col bg-merris-surface py-[18px]"
      style={{ borderRight: `1px solid ${merrisTokens.border}` }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-[18px] pb-[22px]">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-merris-sm bg-merris-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[14px] font-bold text-merris-text">Merris</div>
          <div className="font-body text-[9px] font-medium uppercase tracking-wider text-merris-primary">
            ESG Intelligence
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'flex items-center gap-2.5 px-[18px] py-2 font-display text-[12.5px] transition-colors',
                active
                  ? 'border-l-[3px] border-merris-primary bg-merris-primary-bg font-semibold text-merris-primary'
                  : 'border-l-[3px] border-transparent text-merris-text-secondary hover:bg-merris-surface-low',
              )}
            >
              <Icon d={n.iconPath} color={active ? merrisTokens.primary : merrisTokens.textTertiary} />
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* New Analysis CTA */}
      <div className="px-[18px]">
        <Link href="/intelligence">
          <MerrisButton
            variant="primary"
            className="w-full justify-center text-[12px]"
            style={{ padding: '8px 14px' }}
          >
            + New Analysis
          </MerrisButton>
        </Link>
      </div>

      {/* User chip */}
      <div className="flex items-center gap-1.5 px-[18px] pt-2.5">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-surface-high">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textSecondary} strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[11px] font-medium text-merris-text">Alex Thorne</div>
          <div className="font-body text-[9px] text-merris-text-tertiary">Senior Lead</div>
        </div>
      </div>
    </nav>
  );
}
