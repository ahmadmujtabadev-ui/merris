/**
 * Shared API client for Merris Office Add-ins.
 * Wraps fetch with JWT auth and base URL configuration.
 */

const DEFAULT_BASE_URL = "https://distinct-uncoincidentally-brycen.ngrok-free.dev/api/v1";

let _baseUrl: string = DEFAULT_BASE_URL;
let _token: string | null = null;

export function configure(options: { baseUrl?: string; token?: string }): void {
  if (options.baseUrl) {
    _baseUrl = options.baseUrl;
  }
  if (options.token) {
    _token = options.token;
    localStorage.setItem("merris_token", options.token);
  }
}

export function getToken(): string | null {
  if (_token) return _token;
  _token = localStorage.getItem("merris_token");
  return _token;
}

export function clearToken(): void {
  _token = null;
  localStorage.removeItem("merris_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${_baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `API ${method} ${path} failed (${response.status}): ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

// ----- Typed API methods for add-ins -----

export interface AgentChatRequest {
  message: string;
  context?: Record<string, unknown>;
  session_id?: string;
}

export interface AgentChatResponse {
  reply: string;
  actions?: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
  session_id: string;
}

export interface DataPoint {
  metric_id: string;
  metric_name: string;
  value: string | number | null;
  unit?: string;
  source?: string;
  confidence?: "high" | "medium" | "low";
  fill_type?: "auto-extracted" | "calculated" | "needs-input";
}

export interface ValidationResult {
  cell: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

export interface DisclosureDraft {
  heading: string;
  framework: string;
  disclosure_id: string;
  content: string;
  citations: Array<{ source: string; page?: number; excerpt?: string }>;
}

export interface ConsistencyIssue {
  location: string;
  value_found: string;
  expected_value?: string;
  message: string;
  severity: "error" | "warning";
}

export function agentChat(req: AgentChatRequest): Promise<AgentChatResponse> {
  return api.post<AgentChatResponse>("/agent/chat", req);
}

export function autoFillData(
  metrics: string[]
): Promise<{ data_points: DataPoint[] }> {
  return api.post<{ data_points: DataPoint[] }>("/agent/auto-fill", {
    metrics,
  });
}

export function validateData(
  data: Record<string, unknown>[]
): Promise<{ results: ValidationResult[] }> {
  return api.post<{ results: ValidationResult[] }>("/agent/validate", {
    data,
  });
}

export function draftDisclosure(
  heading: string,
  framework: string
): Promise<DisclosureDraft> {
  return api.post<DisclosureDraft>("/agent/draft-disclosure", {
    heading,
    framework,
  });
}

export function checkConsistency(
  document_text: string
): Promise<{ issues: ConsistencyIssue[] }> {
  return api.post<{ issues: ConsistencyIssue[] }>("/agent/check-consistency", {
    document_text,
  });
}

export function getEvidenceTrail(
  metric_id: string
): Promise<{
  metric_id: string;
  sources: Array<{ document: string; page?: number; excerpt?: string }>;
}> {
  return api.get(`/agent/evidence/${encodeURIComponent(metric_id)}`);
}
