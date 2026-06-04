import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveFeedbackSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  file_id: z.string().describe('File ID to read comments from'),
};

export async function driveFeedback(client: ApiClient, args: {
  workspace_id: string;
  file_id: string;
}) {
  const comments = await client.getAllComments(args.workspace_id, args.file_id);

  if (comments.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No comments on this file.' }],
    };
  }

  const formatted = comments.map(c => {
    const author = c.author_name || c.author_id;
    const lines = c.line_start
      ? ` (lines ${c.line_start}${c.line_end ? `-${c.line_end}` : ''})`
      : '';
    return `[${c.author_type}] ${author}${lines} — ${c.created_at}:\n${c.body}`;
  }).join('\n\n---\n\n');

  return {
    content: [{
      type: 'text' as const,
      text: `Comments (${comments.length}):\n\n${formatted}`,
    }],
  };
}
