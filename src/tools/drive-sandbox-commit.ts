import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveSandboxCommitSchema = {
  workspace_id: z.string().describe('Workspace whose sandbox to commit'),
  message: z.string().min(1).max(500).describe('Commit message'),
  author_name: z.string().optional().describe('Override git author name (default: agent identity)'),
  author_email: z.string().email().optional().describe('Override git author email (default: agent identity)'),
};

export async function driveSandboxCommit(client: ApiClient, args: {
  workspace_id: string;
  message: string;
  author_name?: string;
  author_email?: string;
}) {
  const author =
    args.author_name && args.author_email
      ? { name: args.author_name, email: args.author_email }
      : undefined;

  const result = await client.sandboxCommit(args.workspace_id, {
    message: args.message,
    author,
  });

  return {
    content: [{
      type: 'text' as const,
      text:
        `Committed ${result.commit_sha.slice(0, 8)} on ${result.branch} ` +
        `(${result.files_changed} file${result.files_changed === 1 ? '' : 's'} changed). ` +
        `Surfaced as AgentDrive artifact at ${result.artifact_path}.`,
    }],
  };
}
