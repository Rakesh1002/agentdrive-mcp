import { describe, it, expect } from 'vitest';
import { ApiClient, type AgentRunRecord } from '../src/api-client.js';
import { driveSessions } from '../src/tools/drive-sessions.js';
import { driveResume } from '../src/tools/drive-resume.js';
import { renderSession } from '../src/session.js';

function run(overrides: Partial<AgentRunRecord>): AgentRunRecord {
  return {
    run_id: 'codex:s1',
    org_id: 'org_1',
    workspace_id: 'ws_1',
    agent_id: 'agt_1',
    agent_platform: 'codex',
    task: 'session',
    artifacts_referenced: [],
    artifacts_produced: ['a.md'],
    status: 'in_progress',
    metadata: { project: 'proj', transcript_path: 'sessions/proj/codex/s1.md', title: 'Fix login' },
    created_at: Date.now() - 3_600_000,
    updated_at: Date.now() - 60_000,
    ...overrides,
  };
}

const TRANSCRIPT = renderSession({
  harness: 'codex',
  sessionId: 's1',
  project: 'proj',
  updatedAt: '2026-10-21T10:00:00Z',
  filesTouched: ['src/auth.ts'],
  turns: [
    { role: 'user', text: 'Fix the login bug' },
    { role: 'assistant', text: 'Patched src/auth.ts' },
  ],
});

interface Routes {
  runs?: AgentRunRecord[];
  file?: { path: string; content: string };
}

function client(routes: Routes, opts: { project?: string; agentPlatform?: string } = {}) {
  const calls: string[] = [];
  const fetchImpl = async (input: string) => {
    calls.push(input);
    const url = new URL(input);
    let data: unknown;
    if (url.pathname === '/v1/runs') {
      data = routes.runs ?? [];
    } else if (url.pathname.startsWith('/v1/runs/')) {
      const id = decodeURIComponent(url.pathname.slice('/v1/runs/'.length));
      data = (routes.runs ?? []).find((r) => r.run_id === id);
      if (!data) return new Response(JSON.stringify({ success: false, error: 'Run not found' }), { status: 404 });
    } else if (url.pathname.endsWith('/files') && routes.file) {
      data = [{ id: 'f1', path: routes.file.path, version: 1, size: 1, updated_at: '' }];
    } else if (url.pathname.endsWith('/files/f1') && routes.file) {
      data = { id: 'f1', path: routes.file.path, content: routes.file.content, version: 1, updated_at: '' };
    } else {
      return new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 404 });
    }
    return new Response(JSON.stringify({ success: true, data, cursor: null }), { status: 200 });
  };
  return {
    calls,
    api: new ApiClient({ baseUrl: 'https://api.test', apiKey: 'k', fetchImpl, ...opts }),
  };
}

describe('drive_sessions', () => {
  it('lists sessions for the client project', async () => {
    const { api, calls } = client({ runs: [run({})] }, { project: 'proj' });
    const res = await driveSessions(api, {});
    expect(calls[0]).toContain('/v1/runs?project=proj&limit=10');
    expect(res.content[0].text).toContain('codex · Fix login · id=codex:s1 · files_uploaded=1');
    expect(res.content[0].text).toContain('1m ago');
  });

  it('asks for a project when none is known', async () => {
    const { api } = client({});
    const res = await driveSessions(api, {});
    expect(res.content[0].text).toContain('Pass `project`');
  });

  it('reports an empty project', async () => {
    const { api } = client({ runs: [] });
    const res = await driveSessions(api, { project: 'empty' });
    expect(res.content[0].text).toBe('No prior sessions for project empty.');
  });
});

describe('drive_resume', () => {
  it('picks the newest session from a different harness and returns a handoff', async () => {
    const runs = [
      run({ run_id: 'claude-code:mine', agent_platform: 'claude-code', metadata: { transcript_path: 'sessions/proj/claude-code/mine.md' } }),
      run({}),
    ];
    const { api, calls } = client({ runs, file: { path: 'sessions/proj/codex/s1.md', content: TRANSCRIPT } }, { project: 'proj', agentPlatform: 'claude-code' });
    const res = await driveResume(api, {});
    expect(calls.some((c) => c.includes('prefix=sessions%2Fproj%2Fcodex%2Fs1.md'))).toBe(true);
    expect(res.content[0].text).toContain('Handoff from a codex session (s1).');
    expect(res.content[0].text).toContain('Fix the login bug');
    expect(res.content[0].text).toContain('Patched src/auth.ts');
    expect(res.content[0].text).toMatch(/## Uploaded files\n\n.*workspace ws_1[\s\S]*- a\.md/);
  });

  it('falls back to the newest session when all are from the caller platform', async () => {
    const { api } = client({ runs: [run({})], file: { path: 'sessions/proj/codex/s1.md', content: TRANSCRIPT } }, { project: 'proj', agentPlatform: 'codex' });
    const res = await driveResume(api, {});
    expect(res.content[0].text).toContain('Handoff from a codex session');
  });

  it('returns the encrypted hint for client-side encrypted transcripts', async () => {
    const { api } = client({ runs: [run({})], file: { path: 'sessions/proj/codex/s1.md', content: 'agentdrive-encrypted:v0:abc' } });
    const res = await driveResume(api, { session_id: 'codex:s1' });
    expect(res.content[0].text).toBe('This session is encrypted client-side; run `adrive resume codex:s1` in a shell to view it.');
  });

  it('reports when the project has no sessions', async () => {
    const { api } = client({ runs: [] }, { project: 'proj' });
    const res = await driveResume(api, {});
    expect(res.content[0].text).toBe('No prior sessions for project proj.');
  });
});
