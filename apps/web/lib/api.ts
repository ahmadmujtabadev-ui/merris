import type { StreamEvent } from '@merris/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// ----- Domain types (loose; tighten as pages bind) -----

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Engagement {
  id: string;
  name: string;
  status: string;
  scope?: string;
  deadline?: string;
  frameworks?: string[];
  completeness?: number;
}

export interface IngestedDocument {
  id: string;
  filename: string;
  format: string;
  size: number;
  status: string;
  createdAt: string;
  // Plain-text content extracted from the source file by ingestion. Optional
  // because not every document has been processed yet.
  extractedText?: string;
}

export interface KnowledgeCollection {
  id: string;
  code: string;     // K1..K7
  name: string;
  description?: string;
  entryCount?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{
    id: string;
    name: string;
    tool: string;
    inputs: Record<string, unknown>;
  }>;
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  engagementId: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  results: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ChatRequestPayload {
  engagementId: string;
  message: string;
  userId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  documentBody?: string;
  cursorSection?: string;
  jurisdiction?: string;
  sector?: string;
  ownershipType?: string;
  documentId?: string;
  knowledgeSources?: string[];
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers: customHeaders, ...rest } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((customHeaders as Record<string, string>) ?? {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, errorBody.message ?? 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async upload<T>(endpoint: string, file: File, fieldName = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, errorBody.message ?? 'Upload failed');
    }

    return response.json() as Promise<T>;
  }

  // ===== Auth =====
  login(email: string, password: string) {
    return this.post<LoginResponse>('/auth/login', { email, password });
  }

  register(payload: { email: string; password: string; name: string; orgName?: string }) {
    return this.post<LoginResponse>('/auth/register', payload);
  }

  getMe() {
    return this.get<{ user: AuthUser }>('/auth/me');
  }

  // ===== Engagements (ingestion module) =====
  listEngagements() {
    return this.get<{ engagements: Engagement[] }>('/engagements');
  }

  getEngagement(id: string) {
    return this.get<{ engagement: Engagement }>(`/engagements/${id}`);
  }

  listEngagementDocuments(engagementId: string) {
    return this.get<{ documents: IngestedDocument[] }>(`/engagements/${engagementId}/documents`);
  }

  getDocument(documentId: string) {
    return this.get<{ document: IngestedDocument & { content?: string } }>(`/documents/${documentId}`);
  }

  uploadEngagementDocument(engagementId: string, file: File) {
    return this.upload<{ document: IngestedDocument }>(
      `/engagements/${engagementId}/documents`,
      file,
    );
  }

  createEngagement(payload: { name: string; frameworks?: string[]; deadline?: string }) {
    return this.post<{ engagement: Engagement }>('/engagements', payload);
  }

  // ===== Agent chat — regular JSON POST to /agent/chat =====
  chat(payload: ChatRequestPayload) {
    return this.post<{
      response: string;
      toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
      citations: Array<{ id: string; title: string; source: string; year: number; url?: string; domain: string; excerpt: string; verified: boolean }>;
      references: string[];
      confidence: 'high' | 'medium' | 'low';
      data_gaps: string[];
      evaluation?: { score: number; decision: string; flags?: unknown };
    }>('/agent/chat', payload);
  }

  // ===== Assistant (chat) — SSE path =====
  /**
   * Streams typed events from POST /assistant/chat with Accept: text/event-stream.
   * The caller's onEvent callback fires for each parsed event; the returned promise
   * resolves when the stream ends ({type:'done'}).
   *
   * Implements line-buffered SSE parsing per the W3C eventsource spec.
   */
  async chatStream(payload: ChatRequestPayload, onEvent: (event: StreamEvent) => void): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, errBody || 'Stream request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines
      let sepIdx;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr) as StreamEvent;
            onEvent(parsed);
            if (parsed.type === 'done') return;
          } catch {
            // skip malformed line
          }
        }
      }
    }
  }

  getChatSuggestions() {
    return this.get<{ suggestions: string[] }>('/assistant/suggestions');
  }

  getEngagementMemory(engagementId: string) {
    return this.get<{ memory: unknown }>(`/assistant/memory/${engagementId}`);
  }

  // ===== Knowledge base =====
  listKnowledgeCollections() {
    return this.get<{ collections: KnowledgeCollection[] }>('/knowledge-base/collections');
  }

  searchKnowledge(query: string, collectionId?: string) {
    return this.post<{ results: Array<{ id: string; title: string; excerpt: string; collection: string }> }>(
      '/knowledge-base/search',
      { query, ...(collectionId ? { collectionId } : {}) },
    );
  }

  searchKnowledgeBase(query: string, domains?: string[], limit = 10) {
    return this.post<{
      results: Array<{
        id: string;
        domain: string;
        collection: string;
        title: string;
        description: string;
        score: number;
        source: string;
        year: number;
        ingested: boolean;
      }>;
      totalCandidates: number;
      searchTime: number;
    }>('/knowledge-base/search', { query, domains, limit });
  }

  ingestKBReport(file: File, meta: { company: string; reportYear: number; sector: string; country: string; disclosureId?: string }) {
    const form = new FormData();
    form.append('file', file);
    form.append('company', meta.company);
    form.append('reportYear', String(meta.reportYear));
    form.append('sector', meta.sector);
    form.append('country', meta.country);
    if (meta.disclosureId) form.append('disclosureId', meta.disclosureId);

    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    return fetch(`${API_BASE}/knowledge-base/ingest-report`, {
      method: 'POST', headers, body: form,
    }).then(async (r) => {
      if (!r.ok) throw new ApiError(r.status, await r.text());
      return r.json() as Promise<{ result: { reportId: string; metricsCount: number; narrativesCount: number } }>;
    });
  }

  listKBReports(filters?: { sector?: string; country?: string }) {
    const qs = new URLSearchParams(filters as Record<string, string>).toString();
    return this.get<{ reports: Array<{ id: string; company: string; reportYear: number; sector: string; country: string; quality: { overallScore: number }; metricsCount: number }> }>(
      `/knowledge-base/reports${qs ? '?' + qs : ''}`,
    );
  }

  // ===== Workflows (real backend routes) =====
  listWorkflowTemplates() {
    return this.get<{ templates: WorkflowTemplate[] }>('/workflows/templates');
  }

  getWorkflowTemplate(templateId: string) {
    return this.get<WorkflowTemplate>(`/workflows/templates/${templateId}`);
  }

  runWorkflowTemplate(templateId: string, engagementId: string, inputs?: Record<string, unknown>) {
    return this.post<WorkflowExecution>(`/workflows/${templateId}/run`, {
      engagementId,
      inputs: inputs ?? {},
    });
  }

  getWorkflowExecutionStatus(executionId: string) {
    return this.get<WorkflowExecution>(`/workflows/${executionId}/status`);
  }

  listWorkflowHistory() {
    return this.get<{ executions: WorkflowExecution[] }>('/workflows/history');
  }

  generateBuilderSteps(description: string) {
    return this.post<{
      steps: Array<{ id: string; name: string; description: string; tool: string }>;
    }>('/workflows/builder/generate-steps', { description });
  }

  // ===== Assurance =====
  runAssurancePack(engagementId: string) {
    return this.post<{ packId: string; findings: unknown[] }>(
      `/engagements/${engagementId}/assurance-pack`,
      {},
    );
  }

  getDisclosureFindings(engagementId: string, disclosureId: string) {
    return this.get<{ findings: Array<{ id: string; severity: string; title: string; description: string }> }>(
      `/engagements/${engagementId}/disclosures/${disclosureId}/findings`,
    );
  }

  // ===== Frameworks =====
  listFrameworks() {
    return this.get<{ frameworks: Array<{ id: string; code: string; name: string; version: string }> }>(
      '/frameworks',
    );
  }

  // ===== Phase G scaffolding (placeholder data with `seeded: false`) =====
  listKnowledgeBaseCollections() {
    return this.get<{
      seeded: boolean;
      collections: Array<{ id: string; name: string; count: number }>;
    }>('/knowledge-base/collections');
  }

  getEngagementFrameworkCompliance(engagementId: string) {
    return this.get<{
      seeded: boolean;
      compliance: Array<{ code: string; percent: number }>;
      disclosureMatrix: Array<{
        requirement: string;
        framework: string;
        status: 'Complete' | 'Partial' | 'Gap' | 'Not Started' | 'In Progress';
        coverage: string;
      }>;
    }>(`/engagements/${engagementId}/framework-compliance`);
  }

  getEngagementFindings(engagementId: string) {
    return this.get<{
      seeded: boolean;
      findings: Array<{
        id: string;
        severity: 'CRITICAL' | 'IMPORTANT' | 'MINOR';
        ref: string;
        title: string;
        description: string;
      }>;
    }>(`/engagements/${engagementId}/findings`);
  }

  getAssistantHistory(engagementId?: string) {
    const qs = engagementId ? `?engagementId=${engagementId}` : '';
    return this.get<{
      seeded: boolean;
      history: Array<{
        id: string;
        text: string;
        answer?: string;
        engagement?: string;
        engagementId?: string;
        toolsUsed?: string[];
        timestamp?: string;
        // legacy scaffolding fields
        confidence?: 'High' | 'Medium' | 'Low';
        findings?: number;
        time?: string;
      }>;
    }>(`/assistant/history${qs}`);
  }

  getTeam() {
    return this.get<{
      seeded: boolean;
      members: Array<{ id: string; name: string; role: string; status: 'Active' | 'Pending' }>;
    }>('/team');
  }

  getPreferences() {
    return this.get<{
      seeded: boolean;
      preferences: { primarySector: string; language: string; notifications: string };
    }>('/preferences');
  }

  getBilling() {
    return this.get<{
      seeded: boolean;
      billing: { plan: string; computeCredits: string; nextRenewal: string; paymentLast4: string };
    }>('/billing');
  }

  // ===== Document annotations (Phase K-lite) =====
  listDocumentAnnotations(documentId: string) {
    return this.get<{
      annotations: Array<{
        id: string;
        documentId: string;
        severity: 'CRITICAL' | 'IMPORTANT' | 'MINOR';
        ref: string;
        title: string;
        description: string;
        suggestedFix?: string;
        status: 'pending' | 'applied' | 'dismissed';
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/documents/${documentId}/annotations`);
  }

  updateDocumentAnnotation(
    documentId: string,
    annotationId: string,
    status: 'pending' | 'applied' | 'dismissed',
  ) {
    return this.patch<{
      annotation: {
        id: string;
        documentId: string;
        severity: 'CRITICAL' | 'IMPORTANT' | 'MINOR';
        ref: string;
        title: string;
        description: string;
        suggestedFix?: string;
        status: 'pending' | 'applied' | 'dismissed';
        createdAt: string;
        updatedAt: string;
      };
    }>(`/documents/${documentId}/annotations/${annotationId}`, { status });
  }

  createDocumentAnnotation(
    documentId: string,
    payload: {
      severity: 'CRITICAL' | 'IMPORTANT' | 'MINOR';
      ref: string;
      title: string;
      description: string;
      suggestedFix?: string;
    },
  ) {
    return this.post<{
      annotation: {
        id: string;
        documentId: string;
        severity: 'CRITICAL' | 'IMPORTANT' | 'MINOR';
        ref: string;
        title: string;
        description: string;
        suggestedFix?: string;
        status: 'pending' | 'applied' | 'dismissed';
        createdAt: string;
        updatedAt: string;
      };
    }>(`/documents/${documentId}/annotations`, payload);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
