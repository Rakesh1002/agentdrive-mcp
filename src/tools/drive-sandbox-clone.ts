import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveSandboxCloneSchema = {
  workspace_id: z.string().describe('Workspace to clone into. The sandbox persists across MCP sessions per workspace.'),
  url: z.string().url().describe('Git repository URL to clone'),
  branch: z.string().optional().describe('Branch to check out (default: repo default)'),
  depth: z.number().int().positive().max(50).optional().describe('Shallow clone depth (default: full clone)'),
};

export async function driveSandboxClone(client: ApiClient, args: {
  workspace_id: string;
  url: string;
  branch?: string;
  depth?: number;
}) {
  const state = await client.sandboxClone(args.workspace_id, {
    url: args.url,
    branch: args.branch,
    depth: args.depth,
  });
  return {
    content: [{
      type: 'text' as const,
      text: `Cloned ${state.repo_url}${state.branch ? '@' + state.branch : ''} into workspace ${state.workspace_id}.`,
    }],
  };
}
