import { z } from 'zod';
import type { ApiClient, ContextArtifact } from '../api-client.js';

export const driveContextSchema = {
  task: z.string().min(1).max(2000).describe('What you are about to do — used to rank prior artifacts by relevance'),
  workspace_id: z.string().optional().describe('Scope to a single workspace; omit for org-wide context'),
  limit: z.number().int().positive().max(20).optional().describe('Max artifacts to return (default 5, max 20)'),
};

export async function driveContext(client: ApiClient, args: {
  task: string;
  workspace_id?: string;
  limit?: number;
}) {
  const { artifacts } = await client.context({
    task: args.task,
    workspace_id: args.workspace_id,
    limit: args.limit ?? 5,
  });

  if (artifacts.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No prior context found.' }] };
  }

  const now = Date.now();
  return {
    content: [{
      type: 'text' as const,
      text: artifacts.map((a) => formatArtifact(a, now)).join('\n\n---\n\n'),
    }],
  };
}

function formatArtifact(a: ContextArtifact, now: number): string {
  const snippet = truncate(a.snippet ?? '', 500);
  const rel = relativeTime(now - a.created_at);
  return `${a.path} (by ${a.agent_id}@${a.agent_platform}, ${rel})\n${snippet}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '...';
}

export function relativeTime(ms: number): string {
  if (ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(mo / 12);
  return `${yr}y ago`;
}
