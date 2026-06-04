import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveDeleteSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  file_id: z.string().describe('File ID to delete'),
};

export async function driveDelete(client: ApiClient, args: { workspace_id: string; file_id: string }) {
  const result = await client.deleteFile(args.workspace_id, args.file_id);
  return { content: [{ type: 'text' as const, text: `Deleted file ${args.file_id} from workspace ${args.workspace_id}` }] };
}
