export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  agentPlatform?: string;
  agentRole?: string;
  // Override the fetch implementation. The hosted MCP server (in-worker) passes
  // a self service-binding fetch here so its REST calls dispatch in-process
  // instead of looping back through the edge (which 522s). Defaults to global fetch.
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface PagedResponse<T> {
  items: T[];
  cursor: string | null;
}

interface ListPageFetcher<T> {
  (cursor: string | null): Promise<PagedResponse<T>>;
}

// MAX_PAGES caps total to prevent unbounded loops; pass cursor explicitly if more needed.
export async function listAllPages<T>(
  fetchPage: ListPageFetcher<T>,
  maxPages = 10,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    all.push(...page.items);
    if (!page.cursor) return all;
    cursor = page.cursor;
  }
  return all;
}

export interface SearchHit {
  path: string;
  ws_id: string;
  content_hash: string;
  score: number;
  snippet?: string;
  agent_id: string;
  agent_platform: string;
  created_at: number;
}

export interface SearchFilterInput {
  agent_platform?: string;
  agent_id?: string;
  path_prefix?: string;
  kind?: string;
}

export interface SearchRequestBody {
  query: string;
  workspace_id?: string;
  top_k?: number;
  filter?: SearchFilterInput;
}

export interface ContextRequestBody {
  task: string;
  workspace_id?: string;
  limit?: number;
}

export interface ContextArtifact extends SearchHit {}

export type RunStatus = 'success' | 'failure' | 'partial' | 'in_progress';

export interface RunRequestBody {
  task: string;
  status: RunStatus;
  run_id?: string;
  artifacts_referenced?: string[];
  artifacts_produced?: string[];
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private agentPlatform: string;
  private agentRole: string;
  private fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.agentPlatform = config.agentPlatform ?? 'claude-code';
    this.agentRole = config.agentRole ?? '';
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Agent-Platform': this.agentPlatform,
      'X-Agent-Role': this.agentRole,
    };
  }

  async rawFetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}/v1${path}`;
    return this.fetchImpl(url, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
    });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.rawFetch(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json() as { success: boolean; data?: T; error?: string };
    if (!res.ok || !json.success) {
      throw new Error(json.error || `API request failed: ${res.status}`);
    }
    return json.data as T;
  }

  private async requestPage<T>(method: string, path: string, body?: unknown): Promise<PagedResponse<T>> {
    const res = await this.rawFetch(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json() as { success: boolean; data?: T[]; cursor?: string | null; error?: string };
    if (!res.ok || !json.success) {
      throw new Error(json.error || `API request failed: ${res.status}`);
    }
    return { items: (json.data ?? []) as T[], cursor: json.cursor ?? null };
  }

  async createWorkspace(name: string) {
    return this.request<{ id: string; name: string; created_at: string }>('POST', '/workspaces', { name });
  }

  async writeFile(workspaceId: string, path: string, content: string, message?: string) {
    return this.request<{
      id: string; workspace_id: string; path: string;
      version: number; created_at: string; updated_at: string;
    }>('POST', `/workspaces/${workspaceId}/files`, { path, content, message });
  }

  async readFile(workspaceId: string, fileId: string) {
    return this.request<{
      id: string; path: string; content: string;
      version: number; updated_at: string;
    }>('GET', `/workspaces/${workspaceId}/files/${fileId}?content=true`);
  }

  async listFilesPage(workspaceId: string, prefix: string | undefined, cursor: string | null) {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    if (cursor) params.set('cursor', cursor);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestPage<{
      id: string; path: string; version: number;
      size: number; updated_at: string;
    }>('GET', `/workspaces/${workspaceId}/files${query}`);
  }

  async listAllFiles(workspaceId: string, prefix?: string, maxPages = 10) {
    return listAllPages((cursor) => this.listFilesPage(workspaceId, prefix, cursor), maxPages);
  }

  async deleteFile(workspaceId: string, fileId: string) {
    return this.request<{ deleted: boolean }>('DELETE', `/workspaces/${workspaceId}/files/${fileId}`);
  }

  async getVersionsPage(workspaceId: string, fileId: string, cursor: string | null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.requestPage<{
      version: number; actor_type: string; actor_id: string;
      created_at: string; message?: string;
    }>('GET', `/workspaces/${workspaceId}/files/${fileId}/versions${query}`);
  }

  async getAllVersions(workspaceId: string, fileId: string, maxPages = 10) {
    return listAllPages((cursor) => this.getVersionsPage(workspaceId, fileId, cursor), maxPages);
  }

  async createShareLink(workspaceId: string, permission: 'view' | 'comment' | 'edit', fileId?: string, expiresIn?: number, maxUses?: number, email?: string) {
    return this.request<{
      token_id: string; url: string; permission: string;
      email_gated: boolean; expires_at?: string;
    }>('POST', `/workspaces/${workspaceId}/share`, {
      permission,
      file_id: fileId,
      expires_in: expiresIn,
      max_uses: maxUses,
      email,
    });
  }

  async addComment(workspaceId: string, fileId: string, body: string, authorName?: string, lineStart?: number, lineEnd?: number) {
    return this.request<{
      id: string; body: string; author_type: string;
      created_at: string;
    }>('POST', `/workspaces/${workspaceId}/files/${fileId}/comments`, {
      body, author_name: authorName,
      line_start: lineStart, line_end: lineEnd,
    });
  }

  async getCommentsPage(workspaceId: string, fileId: string, cursor: string | null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.requestPage<{
      id: string; body: string; author_type: string;
      author_id: string; author_name?: string;
      created_at: string; line_start?: number; line_end?: number;
    }>('GET', `/workspaces/${workspaceId}/files/${fileId}/comments${query}`);
  }

  async getAllComments(workspaceId: string, fileId: string, maxPages = 10) {
    return listAllPages((cursor) => this.getCommentsPage(workspaceId, fileId, cursor), maxPages);
  }

  async getActivityPage(workspaceId: string, cursor: string | null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.requestPage<{
      id: string; action: string; actor_type: string;
      actor_id: string; target_path?: string;
      created_at: string;
    }>('GET', `/workspaces/${workspaceId}/activity${query}`);
  }

  async getAllActivity(workspaceId: string, maxPages = 10) {
    return listAllPages((cursor) => this.getActivityPage(workspaceId, cursor), maxPages);
  }

  async assignRole(workspaceId: string, email: string, permission: 'view' | 'comment' | 'edit') {
    return this.request<{
      workspace_id: string; email: string; permission: string;
      assigned_at: string;
    }>('POST', `/workspaces/${workspaceId}/roles`, { email, permission });
  }

  async getRolesPage(workspaceId: string, cursor: string | null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.requestPage<{
      email: string; permission: string;
      assigned_by: string; assigned_at: string;
    }>('GET', `/workspaces/${workspaceId}/roles${query}`);
  }

  async getAllRoles(workspaceId: string, maxPages = 10) {
    return listAllPages((cursor) => this.getRolesPage(workspaceId, cursor), maxPages);
  }

  async removeRole(workspaceId: string, email: string) {
    return this.request<{ deleted: boolean }>('DELETE', `/workspaces/${workspaceId}/roles/${encodeURIComponent(email)}`);
  }

  async inviteMember(email: string, role: 'owner' | 'admin' | 'member' = 'member') {
    return this.request<{
      org_id: string; email: string; role: string;
    }>('POST', '/org/invite', { email, role });
  }

  async getOrg(maxPages = 10) {
    // Org returns agents + members each with its own cursor; loop both to exhaustion.
    const first = await this.fetchOrgPage(undefined, undefined);
    const agents = [...first.agents];
    const members = [...first.members];
    let agentsCursor = first.agents_cursor ?? undefined;
    let membersCursor = first.members_cursor ?? undefined;
    for (let i = 1; i < maxPages && agentsCursor; i++) {
      const page = await this.fetchOrgPage(agentsCursor, undefined);
      agents.push(...page.agents);
      agentsCursor = page.agents_cursor ?? undefined;
    }
    for (let i = 1; i < maxPages && membersCursor; i++) {
      const page = await this.fetchOrgPage(undefined, membersCursor);
      members.push(...page.members);
      membersCursor = page.members_cursor ?? undefined;
    }
    return {
      ...first.org,
      agents,
      members,
      usage: first.usage,
      quota: first.quota,
    };
  }

  private async fetchOrgPage(agentsCursor: string | undefined, membersCursor: string | undefined): Promise<{
    org: {
      id: string; name: string; plan: string;
    };
    agents: Array<{ agent_id: string; agent_name?: string; agent_email?: string }>;
    members: Array<{ email: string; role: string }>;
    agents_cursor: string | null;
    members_cursor: string | null;
    usage: { storage_bytes: number; agent_count: number; workspace_count: number; member_count: number };
    quota: { storage_bytes: number; max_agents: number; max_workspaces: number; max_human_seats: number };
  }> {
    const params = new URLSearchParams();
    if (agentsCursor) params.set('agents_cursor', agentsCursor);
    if (membersCursor) params.set('members_cursor', membersCursor);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.rawFetch(`/org${query}`, { method: 'GET' });
    const json = await res.json() as {
      success: boolean;
      data?: {
        id: string; name: string; plan: string;
        agents: Array<{ agent_id: string; agent_name?: string; agent_email?: string }>;
        members: Array<{ email: string; role: string }>;
        usage: { storage_bytes: number; agent_count: number; workspace_count: number; member_count: number };
        quota: { storage_bytes: number; max_agents: number; max_workspaces: number; max_human_seats: number };
      };
      agents_cursor?: string | null;
      members_cursor?: string | null;
      error?: string;
    };
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error || `API request failed: ${res.status}`);
    }
    const { agents, members, usage, quota, ...org } = json.data;
    return {
      org,
      agents,
      members,
      usage,
      quota,
      agents_cursor: json.agents_cursor ?? null,
      members_cursor: json.members_cursor ?? null,
    };
  }

  async getBillingPlan() {
    return this.request<{
      plan: string;
      trial_ends_at?: string;
      usage: Record<string, number>;
      quota: Record<string, number>;
    }>('GET', '/billing/plan');
  }

  async search(body: SearchRequestBody): Promise<{ hits: SearchHit[]; total: number }> {
    return this.request<{ hits: SearchHit[]; total: number }>('POST', '/search', body);
  }

  async context(body: ContextRequestBody): Promise<{ artifacts: ContextArtifact[]; retrieved_at: number }> {
    return this.request<{ artifacts: ContextArtifact[]; retrieved_at: number }>('POST', '/context', body);
  }

  async logRun(body: RunRequestBody): Promise<{ run_id: string; created_at: number }> {
    return this.request<{ run_id: string; created_at: number }>('POST', '/runs', body);
  }

  // --- Sandbox (Wave 5 Stream D) ---
  async sandboxClone(workspaceId: string, body: { url: string; branch?: string; depth?: number }) {
    return this.request<{
      workspace_id: string;
      repo_url?: string;
      branch?: string;
      head_sha?: string;
      last_active_at?: number;
    }>('POST', `/workspaces/${workspaceId}/sandbox/clone`, body);
  }

  async sandboxExec(workspaceId: string, body: { cmd: string; cwd?: string; timeout_ms?: number }) {
    return this.request<{
      exit_code: number;
      stdout: string;
      stderr: string;
      duration_ms: number;
      truncated: boolean;
    }>('POST', `/workspaces/${workspaceId}/sandbox/exec`, body);
  }

  async sandboxRead(workspaceId: string, path: string) {
    const cleaned = path.startsWith('/') ? path : `/${path}`;
    return this.request<{ content: string; size: number; truncated: boolean }>(
      'GET',
      `/workspaces/${workspaceId}/sandbox/files${cleaned}`,
    );
  }

  async sandboxCommit(workspaceId: string, body: { message: string; author?: { name: string; email: string } }) {
    return this.request<{
      commit_sha: string;
      branch: string;
      files_changed: number;
      artifact_path: string;
    }>('POST', `/workspaces/${workspaceId}/sandbox/commit`, body);
  }
}
