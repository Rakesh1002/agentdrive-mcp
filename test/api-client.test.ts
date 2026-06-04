import { describe, it, expect, afterEach } from 'vitest';
import { ApiClient, listAllPages } from '../src/api-client.js';

interface FetchCall {
  url: string;
  init: RequestInit;
}

function mockFetch(responses: Array<{ status?: number; body: unknown }>): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  let i = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
    const r = responses[i++] ?? responses[responses.length - 1];
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => { globalThis.fetch = original; },
  };
}

describe('listAllPages', () => {
  it('accumulates items across pages and stops on null cursor', async () => {
    const pages = [
      { items: [1, 2, 3], cursor: 'c1' },
      { items: [4, 5], cursor: 'c2' },
      { items: [6], cursor: null },
    ];
    let seq = 0;
    const all = await listAllPages<number>(async (cursor) => {
      const expected = seq === 0 ? null : pages[seq - 1].cursor;
      expect(cursor).toBe(expected);
      return pages[seq++];
    });
    expect(all).toEqual([1, 2, 3, 4, 5, 6]);
    expect(seq).toBe(3);
  });

  it('respects maxPages upper bound', async () => {
    let calls = 0;
    const all = await listAllPages<number>(async () => {
      calls++;
      return { items: [calls], cursor: 'never-null' };
    }, 4);
    expect(calls).toBe(4);
    expect(all).toEqual([1, 2, 3, 4]);
  });

  it('returns empty array when first page is empty and cursor null', async () => {
    const all = await listAllPages<number>(async () => ({ items: [], cursor: null }));
    expect(all).toEqual([]);
  });
});

describe('ApiClient identity headers', () => {
  let restore: () => void = () => undefined;
  afterEach(() => restore());

  it('sends X-Agent-Platform default claude-code and empty X-Agent-Role by default', async () => {
    const m = mockFetch([{ body: { success: true, data: { id: 'ws1', name: 'n', created_at: 't' } } }]);
    restore = m.restore;
    const client = new ApiClient({ baseUrl: 'https://api.test', apiKey: 'k' });
    await client.createWorkspace('n');
    const headers = m.calls[0].init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer k');
    expect(headers['X-Agent-Platform']).toBe('claude-code');
    expect(headers['X-Agent-Role']).toBe('');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('honors explicit agentPlatform and agentRole', async () => {
    const m = mockFetch([{ body: { success: true, data: { id: 'ws1', name: 'n', created_at: 't' } } }]);
    restore = m.restore;
    const client = new ApiClient({
      baseUrl: 'https://api.test/',
      apiKey: 'k',
      agentPlatform: 'codex',
      agentRole: 'reviewer',
    });
    await client.createWorkspace('n');
    const headers = m.calls[0].init.headers as Record<string, string>;
    expect(headers['X-Agent-Platform']).toBe('codex');
    expect(headers['X-Agent-Role']).toBe('reviewer');
  });

  it('strips trailing slash from baseUrl and hits /v1 prefix', async () => {
    const m = mockFetch([{ body: { success: true, data: { id: 'ws1', name: 'n', created_at: 't' } } }]);
    restore = m.restore;
    const client = new ApiClient({ baseUrl: 'https://api.test/', apiKey: 'k' });
    await client.createWorkspace('n');
    expect(m.calls[0].url).toBe('https://api.test/v1/workspaces');
  });
});

describe('ApiClient.listAllFiles cursor loop', () => {
  let restore: () => void = () => undefined;
  afterEach(() => restore());

  it('walks pages until cursor null', async () => {
    const m = mockFetch([
      { body: { success: true, data: [{ id: 'f1', path: 'a', version: 1, size: 1, updated_at: 't' }], cursor: 'c1' } },
      { body: { success: true, data: [{ id: 'f2', path: 'b', version: 1, size: 1, updated_at: 't' }], cursor: null } },
    ]);
    restore = m.restore;
    const client = new ApiClient({ baseUrl: 'https://api.test', apiKey: 'k' });
    const files = await client.listAllFiles('ws1');
    expect(files).toHaveLength(2);
    expect(m.calls).toHaveLength(2);
    expect(m.calls[0].url).toBe('https://api.test/v1/workspaces/ws1/files');
    expect(m.calls[1].url).toBe('https://api.test/v1/workspaces/ws1/files?cursor=c1');
  });
});

describe('ApiClient.search/context/logRun', () => {
  let restore: () => void = () => undefined;
  afterEach(() => restore());

  it('POSTs /v1/search and returns hits', async () => {
    const m = mockFetch([
      { body: { success: true, data: { hits: [{ path: 'a', ws_id: 'w', content_hash: 'h', score: 0.9, agent_id: 'ag', agent_platform: 'codex', created_at: 1 }], total: 1 } } },
    ]);
    restore = m.restore;
    const client = new ApiClient({ baseUrl: 'https://api.test', apiKey: 'k' });
    const out = await client.search({ query: 'q' });
    expect(out.total).toBe(1);
    expect(m.calls[0].url).toBe('https://api.test/v1/search');
    expect(m.calls[0].init.method).toBe('POST');
    expect(JSON.parse(m.calls[0].init.body as string)).toEqual({ query: 'q' });
  });

  it('POSTs /v1/runs', async () => {
    const m = mockFetch([{ body: { success: true, data: { run_id: 'r1', created_at: 1 } } }]);
    restore = m.restore;
    const client = new ApiClient({ baseUrl: 'https://api.test', apiKey: 'k' });
    const out = await client.logRun({ task: 't', status: 'success' });
    expect(out.run_id).toBe('r1');
    expect(m.calls[0].url).toBe('https://api.test/v1/runs');
  });
});
