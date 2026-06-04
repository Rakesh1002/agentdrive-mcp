import { z } from 'zod';
import type { ApiClient, SearchHit } from '../api-client.js';

export const driveRecallSchema = {
  query: z.string().min(1).max(2000).describe('Recall query — what fact, preference, or decision are you trying to remember?'),
  top_k: z.number().int().positive().max(20).optional().describe('Max results (default 5, max 20)'),
};

export async function driveRecall(client: ApiClient, args: {
  query: string;
  top_k?: number;
}) {
  // v1 narrows nothing; v1.5 will scope to filter.kind === 'fact' once the fact-extractor lands.
  const { hits } = await client.search({
    query: args.query,
    top_k: args.top_k ?? 5,
  });

  if (hits.length === 0) {
    return { content: [{ type: 'text' as const, text: 'Nothing recalled.' }] };
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
