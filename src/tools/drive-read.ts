import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveReadSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  file_id: z.string().describe('File ID to read'),
};

export async function driveRead(client: ApiClient, args: {
  workspace_id: string;
  file_id: string;
}) {
  const file = await client.readFile(args.workspace_id, args.file_id);
  return {
    content: [{
      type: 'text' as const,
      text: `# ${file.path} (v${file.version})\n\n${file.content}`,
    }],
  };
}
