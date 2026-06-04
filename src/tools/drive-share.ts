import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveShareSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  permission: z.enum(['view', 'comment', 'edit']).describe('Permission level for the share link'),
  file_id: z.string().optional().describe('Scope to a specific file (optional)'),
  expires_in: z.number().optional().describe('Expiry in seconds (optional)'),
  max_uses: z.number().optional().describe('Maximum number of uses (optional)'),
  email: z.string().optional().describe('Email-gate: only this email can access the link (requires email verification). Leave empty for public access.'),
};

export async function driveShare(client: ApiClient, args: {
  workspace_id: string;
  permission: 'view' | 'comment' | 'edit';
  file_id?: string;
  expires_in?: number;
  max_uses?: number;
  email?: string;
}) {
  const share = await client.createShareLink(
    args.workspace_id,
    args.permission,
    args.file_id,
    args.expires_in,
    args.max_uses,
    args.email,
  );

  const emailNote = share.email_gated
    ? `\nEmail-gated: only ${args.email} can access (they'll verify via magic code)`
    : '\nPublic: anyone with the link can access';

  return {
    content: [{
      type: 'text' as const,
      text: `Share link created (${share.permission} access):\n${share.url}${emailNote}${share.expires_at ? `\nExpires: ${share.expires_at}` : ''}`,
    }],
  };
}
