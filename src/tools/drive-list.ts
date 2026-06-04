import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveListSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  prefix: z.string().optional().describe('Path prefix filter (e.g. "notes/")'),
};

export async function driveList(client: ApiClient, args: {
  workspace_id: string;
  prefix?: string;
}) {
  const files = await client.listAllFiles(args.workspace_id, args.prefix);

  if (files.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No files found.' }],
    };
  }

  const listing = files.map(f =>
    `- ${f.path} (v${f.version}, ${f.size} bytes, updated: ${f.updated_at})`
  ).join('\n');

  return {
    content: [{
      type: 'text' as const,
      text: `Files in workspace:\n${listing}`,
    }],
  };
}
