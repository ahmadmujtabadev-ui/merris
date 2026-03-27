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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  org: null,
  locale: 'en',
  sidebarCollapsed: false,

  setAuth: (user, token, org) => {
    api.setToken(token);
    set({ user, token, org });
  },

  logout: () => {
    api.setToken(null);
    set({ user: null, token: null, org: null });
  },

  setLocale: (locale) => set({ locale }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

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
