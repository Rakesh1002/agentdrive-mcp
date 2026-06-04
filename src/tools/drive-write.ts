import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveWriteSchema = {
  workspace_id: z.string().describe('Workspace ID to write to'),
  path: z.string().describe('File path (e.g. "notes/meeting.md")'),
  content: z.string().describe('File content (markdown)'),
  message: z.string().optional().describe('Optional version message'),
};

export async function driveWrite(client: ApiClient, args: {
  workspace_id: string;
  path: string;
  content: string;
  message?: string;
}) {
  const file = await client.writeFile(args.workspace_id, args.path, args.content, args.message);
  return {
    content: [{
      type: 'text' as const,
      text: `File written: ${file.path} (v${file.version}, id: ${file.id})`,
    }],
  };
}
