import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveActivitySchema = {
  workspace_id: z.string().describe('Workspace ID'),
};

export async function driveActivity(client: ApiClient, args: {
  workspace_id: string;
}) {
  const events = await client.getAllActivity(args.workspace_id);

  if (events.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No recent activity.' }],
    };
  }

  const formatted = events.map(e => {
    const path = e.target_path ? ` → ${e.target_path}` : '';
    return `[${e.actor_type}] ${e.actor_id}: ${e.action}${path} — ${e.created_at}`;
  }).join('\n');

  return {
    content: [{
      type: 'text' as const,
      text: `Recent activity (${events.length}):\n${formatted}`,
    }],
  };
}
