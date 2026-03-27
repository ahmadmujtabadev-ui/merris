import { create } from 'zustand';
import { api } from './api';

// ---- Local type definitions (mirrors @merris/shared without runtime Zod dependency) ----

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
  preferences: {
    language: 'en' | 'ar';
    timezone: string;
    notifications: {
      email: boolean;
      inApp: boolean;
      teams: boolean;
    };
  };
}

export interface AuthOrganization {
  id: string;
  name: string;
  type: 'consulting' | 'corporate' | 'regulator';
  plan: 'starter' | 'professional' | 'enterprise';
}

export type EngagementStatus =
  | 'setup'
  | 'data_collection'
  | 'drafting'
  | 'review'
  | 'assurance'
  | 'completed';

export interface EngagementSummary {
  id: string;
  name: string;
  clientOrgId?: string;
  frameworks: string[];
  deadline: string;
  status: EngagementStatus;
  completeness?: number;
}

// ---- Auth slice ----

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  org: AuthOrganization | null;
  locale: 'en' | 'ar';
  sidebarCollapsed: boolean;
  setAuth: (user: AuthUser, token: string, org: AuthOrganization) => void;
  logout: () => void;
  setLocale: (locale: 'en' | 'ar') => void;
  toggleSidebar: () => void;
}

function loadAuthFromStorage(): { user: AuthUser | null; token: string | null; org: AuthOrganization | null } {
  if (typeof window === 'undefined') return { user: null, token: null, org: null };
  try {
    const stored = localStorage.getItem('merris_auth');
    if (stored) {
      const parsed = JSON.parse(stored) as { user: AuthUser; token: string; org: AuthOrganization };
      if (parsed.token) {
        api.setToken(parsed.token);
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return { user: null, token: null, org: null };
}

export const useAuthStore = create<AuthState>((set) => {
  const initial = loadAuthFromStorage();
  return {
    user: initial.user,
    token: initial.token,
    org: initial.org,
    locale: 'en',
    sidebarCollapsed: false,

    setAuth: (user, token, org) => {
      api.setToken(token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('merris_auth', JSON.stringify({ user, token, org }));
      }
      set({ user, token, org });
    },

    logout: () => {
      api.setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('merris_auth');
      }
      set({ user: null, token: null, org: null });
    },

    setLocale: (locale) => set({ locale }),

    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  };
});

// ---- Engagement context slice ----

interface EngagementState {
  currentEngagement: EngagementSummary | null;
  engagements: EngagementSummary[];
  setCurrentEngagement: (e: EngagementSummary | null) => void;
  setEngagements: (list: EngagementSummary[]) => void;
}

export const useEngagementStore = create<EngagementState>((set) => ({
  currentEngagement: null,
  engagements: [],
  setCurrentEngagement: (e) => set({ currentEngagement: e }),
  setEngagements: (list) => set({ engagements: list }),
}));
