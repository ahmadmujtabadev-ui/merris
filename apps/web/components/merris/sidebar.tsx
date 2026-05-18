'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { merrisTokens } from '@/lib/design-tokens';
import { MerrisButton } from './button';
import { useAuthStore } from '@/lib/store';

interface NavItem {
  href: string;
  label: string;
  iconPath: string;
  shortcut?: string;
  badge?: string | number;
}

const WORKSPACE_NAV: NavItem[] = [
  { href: '/intelligence',    label: 'Intelligence',    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3', shortcut: '1' },
  { href: '/portfolio',       label: 'Portfolio',       iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', shortcut: '2' },
  { href: '/compliance',      label: 'Compliance',      iconPath: 'M9 12l2 2 4-4M3 12a9 9 0 1018 0 9 9 0 00-18 0z', shortcut: '3' },
  { href: '/knowledge',       label: 'Knowledge',       iconPath: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z', shortcut: '4' },
  { href: '/workflow-agents', label: 'Workflow Agents', iconPath: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z', shortcut: '5' },
  { href: '/history',         label: 'History',         iconPath: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2', shortcut: '6' },
];

const SYSTEM_NAV: NavItem[] = [
  { href: '/workflow-agents/human-in-loop', label: 'HIL Reviews',  iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { href: '/settings#word-addin', label: 'Word add-in', iconPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6' },
  { href: '/config',              label: 'AI Config',   iconPath: 'M4 4h16v16H4zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M20 9h3M1 15h3M20 15h3' },
  { href: '/settings',            label: 'Settings',    iconPath: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 1v2M12 21v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4' },
];

function Icon({ d, color, size = 15 }: { d: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {d.includes('M14 2v6h6') ? (
        <>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </>
      ) : (
        <path d={d} />
      )}
    </svg>
  );
}

function UserInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')
    : (parts[0]?.slice(0, 2) ?? 'U');
  return <span className="font-display text-[11px] font-bold text-white uppercase">{initials}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-4 px-5">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: merrisTokens.textTertiary }}>
        {children}
      </span>
    </div>
  );
}

export function MerrisSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const logout = useAuthStore((s) => s.logout);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts ⌘1-⌘7
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 7) {
        const item = WORKSPACE_NAV[n - 1];
        if (item) { e.preventDefault(); router.push(item.href); }
      }
      if (e.key === 'n') {
        e.preventDefault();
        router.push('/intelligence');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const displayName = user?.name ?? 'User';
  const displayOrg = org?.name ?? '';
  const displayRole = user?.role ?? 'Member';

  return (
    <nav
      className="fixed left-0 top-0 z-[100] flex h-screen w-[210px] flex-col bg-merris-surface"
      style={{ borderRight: `1px solid ${merrisTokens.border}` }}
    >
      {/* ── Brand ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: `1px solid ${merrisTokens.border}` }}>
        <div className="flex h-[32px] w-[32px] items-center justify-center rounded-merris-sm bg-merris-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[14px] font-bold text-merris-text">Merris</div>
          <div className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-merris-primary">ESG Intelligence</div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2">
        <SectionLabel>Workspace</SectionLabel>

        {WORKSPACE_NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'group flex items-center gap-2 px-5 py-[8px] font-display text-[12.5px] transition-colors',
                active
                  ? 'border-l-[2px] border-merris-primary bg-merris-primary-bg font-semibold text-merris-primary'
                  : 'border-l-[2px] border-transparent text-merris-text-secondary hover:bg-merris-surface-low hover:text-merris-text',
              )}
            >
              <Icon d={n.iconPath} color={active ? merrisTokens.primary : merrisTokens.textTertiary} />
              <span className="flex-1 truncate">{n.label}</span>
              {n.badge != null && (
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold"
                  style={{
                    background: active ? 'rgba(255,255,255,0.25)' : merrisTokens.primaryBg,
                    color: active ? '#fff' : merrisTokens.primary,
                  }}
                >
                  {n.badge}
                </span>
              )}
              {n.shortcut && (
                <kbd
                  className="font-mono text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: merrisTokens.textTertiary }}
                >
                  ⌘{n.shortcut}
                </kbd>
              )}
            </Link>
          );
        })}

        <SectionLabel>System</SectionLabel>

        {SYSTEM_NAV.map((n) => {
          const active = pathname === n.href || (n.href !== '/settings#word-addin' && pathname.startsWith(n.href + '/'));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'flex items-center gap-2 px-5 py-[7px] font-display text-[12px] transition-colors',
                active
                  ? 'border-l-[2px] border-merris-primary bg-merris-primary-bg font-semibold text-merris-primary'
                  : 'border-l-[2px] border-transparent text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text',
              )}
            >
              <Icon d={n.iconPath} color={active ? merrisTokens.primary : merrisTokens.textTertiary} size={13} />
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* ── New analysis CTA ───────────────────────────────────── */}
      <div className="px-4 pb-3" style={{ borderTop: `1px solid ${merrisTokens.border}` }}>
        <div className="pt-3">
          <Link href="/intelligence">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-merris-sm bg-merris-primary px-3 py-2 font-display text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              New analysis
              <kbd className="ml-auto rounded border border-white/20 px-1 py-0.5 font-mono text-[9px] text-white/60">⌘N</kbd>
            </button>
          </Link>
        </div>
      </div>

      {/* ── User section ───────────────────────────────────────── */}
      <div className="relative px-3 pb-4" ref={menuRef}>
        <button
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-merris-sm px-2 py-2 hover:bg-merris-surface-low transition-colors"
        >
          <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-merris-primary">
            <UserInitials name={displayName} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate font-display text-[12px] font-semibold text-merris-text">{displayName}</div>
            <div className="truncate font-body text-[9px] text-merris-text-tertiary">
              {displayRole}{displayOrg ? ` · ${displayOrg}` : ''}
            </div>
          </div>
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke={merrisTokens.textTertiary} strokeWidth="1.5"
            className={clsx('shrink-0 transition-transform', userMenuOpen && 'rotate-180')}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {userMenuOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 rounded-merris-sm bg-merris-surface shadow-merris-hover"
            style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
          >
            <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${merrisTokens.border}` }}>
              <div className="font-display text-[12px] font-semibold text-merris-text">{displayName}</div>
              <div className="font-body text-[10px] text-merris-text-tertiary">{user?.email ?? ''}</div>
              {displayOrg && (
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-merris-primary">{displayOrg}</div>
              )}
            </div>
            <div className="py-1">
              <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 font-body text-[12px] text-merris-text hover:bg-merris-surface-low">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM12 1v2M12 21v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>
                Account Settings
              </Link>
              <Link href="/config" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 font-body text-[12px] text-merris-text hover:bg-merris-surface-low">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M20 9h3M1 15h3M20 15h3"/></svg>
                AI Config
              </Link>
            </div>
            <div style={{ borderTop: `1px solid ${merrisTokens.border}` }} className="py-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-3 py-2 font-body text-[12px] text-merris-error hover:bg-merris-error-bg"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
