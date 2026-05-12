import { create } from 'zustand';
import { api } from './api';
import type { WorkflowTemplate, WorkflowExecution, VaultDocument, VaultSearchResult } from './api';

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
        // Restore cookie so middleware can read it on next navigation
        document.cookie = `merris_token=${parsed.token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
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
        // Also persist as a cookie so Next.js middleware can read it
        document.cookie = `merris_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
      }
      set({ user, token, org });
    },

    logout: () => {
      api.setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('merris_auth');
        document.cookie = 'merris_token=; path=/; max-age=0';
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

// ---- History slice ----

export interface HistoryEntry {
  id: string;
  text: string;
  answer?: string;
  engagement?: string;
  engagementId?: string;
  toolsUsed?: string[];
  timestamp?: string;
  confidence?: 'High' | 'Medium' | 'Low';
  findings?: number;
  time?: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  fetchHistory: (engagementId?: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: [],
  loading: false,
  error: null,

  fetchHistory: async (engagementId?: string) => {
    set({ loading: true, error: null });
    try {
      const data = await api.getAssistantHistory(engagementId);
      set({ entries: data.history, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load history', loading: false });
    }
  },
}));

// ---- Knowledge slice ----

export interface KBCollection {
  id: string;
  name: string;
  count: number;
}

export interface KBSearchResult {
  id: string;
  domain: string;
  collection: string;
  title: string;
  description: string;
  score: number;
  source: string;
  year: number;
  ingested: boolean;
}

interface KnowledgeState {
  collections: KBCollection[];
  seeded: boolean;
  searchResults: KBSearchResult[];
  searchQuery: string;
  searching: boolean;
  loadingCollections: boolean;
  fetchCollections: () => Promise<void>;
  search: (query: string, domains?: string[]) => Promise<void>;
  clearSearch: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  collections: [],
  seeded: false,
  searchResults: [],
  searchQuery: '',
  searching: false,
  loadingCollections: false,

  fetchCollections: async () => {
    set({ loadingCollections: true });
    try {
      const data = await api.listKnowledgeBaseCollections();
      set({ collections: data.collections, seeded: data.seeded ?? false, loadingCollections: false });
    } catch {
      set({ loadingCollections: false });
    }
  },

  search: async (query: string, domains?: string[]) => {
    set({ searching: true, searchQuery: query });
    try {
      const data = await api.searchKnowledgeBase(query, domains, 20);
      set({ searchResults: data.results, searching: false });
    } catch {
      set({ searching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], searchQuery: '' }),
}));

// ---- Vault Knowledge Base slice ----

interface VaultStats { total: number; indexed: number; failed: number; processing: number; }

interface VaultKBState {
  documents: VaultDocument[];
  stats: VaultStats;
  loading: boolean;
  uploading: boolean;
  searchResults: VaultSearchResult[];
  searching: boolean;
  fetchDocuments: (workspaceId: string) => Promise<void>;
  fetchStats: (workspaceId: string) => Promise<void>;
  uploadDocument: (workspaceId: string, file: File) => Promise<{ duplicate: boolean }>;
  deleteDocument: (workspaceId: string, docId: string) => Promise<void>;
  retryDocument: (workspaceId: string, docId: string) => Promise<void>;
  search: (workspaceId: string, query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useVaultKBStore = create<VaultKBState>((set, get) => ({
  documents: [],
  stats: { total: 0, indexed: 0, failed: 0, processing: 0 },
  loading: false,
  uploading: false,
  searchResults: [],
  searching: false,

  fetchDocuments: async (workspaceId) => {
    set({ loading: true });
    try {
      const data = await api.listVaultDocuments(workspaceId, { limit: 100 });
      set({ documents: data.documents, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchStats: async (workspaceId) => {
    try {
      const data = await api.getVaultStats(workspaceId);
      set({ stats: data });
    } catch {}
  },

  uploadDocument: async (workspaceId, file) => {
    set({ uploading: true });
    try {
      const result = await api.uploadVaultDocument(workspaceId, file);
      await get().fetchDocuments(workspaceId);
      await get().fetchStats(workspaceId);
      set({ uploading: false });
      return { duplicate: result.duplicate };
    } catch (e) {
      set({ uploading: false });
      throw e;
    }
  },

  deleteDocument: async (workspaceId, docId) => {
    await api.deleteVaultDocument(workspaceId, docId);
    set((s) => ({ documents: s.documents.filter((d) => d.id !== docId) }));
    await get().fetchStats(workspaceId);
  },

  retryDocument: async (workspaceId, docId) => {
    await api.retryVaultDocument(workspaceId, docId);
    await get().fetchDocuments(workspaceId);
  },

  search: async (workspaceId, query) => {
    set({ searching: true });
    try {
      const data = await api.searchVault(workspaceId, { query, limit: 20 });
      set({ searchResults: data.results, searching: false });
    } catch { set({ searching: false }); }
  },

  clearSearch: () => set({ searchResults: [] }),
}));

// ---- Compliance slice ----

export interface ComplianceFramework {
  code: string;
  percent: number;
}

export interface DisclosureRow {
  requirement: string;
  framework: string;
  status: 'Complete' | 'Partial' | 'Gap' | 'Not Started' | 'In Progress';
  coverage: string;
}

interface ComplianceState {
  frameworks: ComplianceFramework[];
  disclosureMatrix: DisclosureRow[];
  loading: boolean;
  fetchCompliance: (engagementId: string) => Promise<void>;
}

export const useComplianceStore = create<ComplianceState>((set) => ({
  frameworks: [],
  disclosureMatrix: [],
  loading: false,

  fetchCompliance: async (engagementId: string) => {
    set({ loading: true });
    try {
      const data = await api.getEngagementFrameworkCompliance(engagementId);
      set({ frameworks: data.compliance, disclosureMatrix: data.disclosureMatrix, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

// ---- Workflow slice ----

interface WorkflowState {
  templates: WorkflowTemplate[];
  executions: WorkflowExecution[];
  activeExecution: WorkflowExecution | null;
  loadingTemplates: boolean;
  running: boolean;
  fetchTemplates: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  runTemplate: (templateId: string, engagementId: string, inputs?: Record<string, unknown>) => Promise<WorkflowExecution>;
  pollStatus: (executionId: string) => Promise<WorkflowExecution>;
  setActiveExecution: (e: WorkflowExecution | null) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  templates: [],
  executions: [],
  activeExecution: null,
  loadingTemplates: false,
  running: false,

  fetchTemplates: async () => {
    set({ loadingTemplates: true });
    try {
      const data = await api.listWorkflowTemplates();
      set({ templates: data.templates, loadingTemplates: false });
    } catch {
      set({ loadingTemplates: false });
    }
  },

  fetchHistory: async () => {
    try {
      const data = await api.listWorkflowHistory();
      set({ executions: data.executions });
    } catch {
      // non-critical
    }
  },

  runTemplate: async (templateId, engagementId, inputs) => {
    set({ running: true });
    const execution = await api.runWorkflowTemplate(templateId, engagementId, inputs);
    set((s) => ({ running: false, activeExecution: execution, executions: [execution, ...s.executions] }));
    return execution;
  },

  pollStatus: async (executionId) => {
    const execution = await api.getWorkflowExecutionStatus(executionId);
    set((s) => ({
      activeExecution: execution,
      executions: s.executions.map((e) => e.id === executionId ? execution : e),
    }));
    return execution;
  },

  setActiveExecution: (e) => set({ activeExecution: e }),
}));
