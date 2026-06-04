import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveVersionsSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  file_id: z.string().describe('File ID'),
};

export async function driveVersions(client: ApiClient, args: { workspace_id: string; file_id: string }) {
  const versions = await client.getAllVersions(args.workspace_id, args.file_id);
  if (versions.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No version history found.' }] };
  }
  const lines = versions.map(v =>
    `v${v.version} | ${v.actor_type}:${v.actor_id} | ${v.created_at}${v.message ? ` | "${v.message}"` : ''}`
  );
  return { content: [{ type: 'text' as const, text: `Version history (${versions.length} versions):\n${lines.join('\n')}` }] };
}
