import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveCommentSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  file_id: z.string().describe('File ID to comment on'),
  body: z.string().describe('Comment text'),
  line_start: z.number().optional().describe('Start line number (optional)'),
  line_end: z.number().optional().describe('End line number (optional)'),
};

export async function driveComment(client: ApiClient, args: {
  workspace_id: string;
  file_id: string;
  body: string;
  line_start?: number;
  line_end?: number;
}) {
  const comment = await client.addComment(
    args.workspace_id, args.file_id,
    args.body, undefined,
    args.line_start, args.line_end,
  );

  return {
    content: [{
      type: 'text' as const,
      text: `Comment added (id: ${comment.id})`,
    }],
  };
}
