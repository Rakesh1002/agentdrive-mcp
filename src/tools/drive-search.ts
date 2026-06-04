import { z } from 'zod';
import type { ApiClient, SearchHit } from '../api-client.js';

const AGENT_PLATFORMS = [
  'claude-code',
  'codex',
  'cursor',
  'langgraph',
  'crewai',
  'autogen',
  'hermes',
  'openclaw',
  'unknown',
] as const;

export const driveSearchSchema = {
  query: z.string().min(1).max(2000).describe('Search query'),
  workspace_id: z.string().optional().describe('Scope to a single workspace; omit for org-wide search'),
  top_k: z.number().int().positive().max(50).optional().describe('Max hits to return (default 10, max 50)'),
  filter: z.object({
    agent_platform: z.enum(AGENT_PLATFORMS).optional(),
    agent_id: z.string().optional(),
    path_prefix: z.string().optional(),
  }).optional(),
};

export async function driveSearch(client: ApiClient, args: {
  query: string;
  workspace_id?: string;
  top_k?: number;
  filter?: { agent_platform?: typeof AGENT_PLATFORMS[number]; agent_id?: string; path_prefix?: string };
}) {
  const { hits } = await client.search({
    query: args.query,
    workspace_id: args.workspace_id,
    top_k: args.top_k ?? 10,
    filter: args.filter,
  });

  if (hits.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No matches.' }] };
  }

  return {
    content: [{ type: 'text' as const, text: hits.map(formatHit).join('\n---\n') }],
  };
}

function formatHit(h: SearchHit): string {
  const score = h.score.toFixed(2);
  const snippet = truncate(h.snippet ?? '', 200);
  const created = new Date(h.created_at).toISOString();
  return `${h.path}\nws=${h.ws_id} · score=${score} · by=${h.agent_id}@${h.agent_platform} · ${created}\n${snippet}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '...';
}
