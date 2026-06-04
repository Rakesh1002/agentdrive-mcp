import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveSandboxExecSchema = {
  workspace_id: z.string().describe('Workspace whose sandbox to run in'),
  cmd: z.string().min(1).max(2048).describe('Shell command to run inside the per-workspace Linux sandbox'),
  cwd: z.string().optional().describe('Working directory (default: workspace root)'),
  timeout_ms: z.number().int().positive().max(60_000).optional().describe('Max runtime in ms (default 30000, hard cap 60000)'),
};

export async function driveSandboxExec(client: ApiClient, args: {
  workspace_id: string;
  cmd: string;
  cwd?: string;
  timeout_ms?: number;
}) {
  const result = await client.sandboxExec(args.workspace_id, {
    cmd: args.cmd,
    cwd: args.cwd,
    timeout_ms: args.timeout_ms,
  });

  const header = `exit=${result.exit_code} duration=${result.duration_ms}ms${result.truncated ? ' [output truncated to 64KB]' : ''}`;
  const stdoutBlock = result.stdout ? `\n--- stdout ---\n${result.stdout}` : '';
  const stderrBlock = result.stderr ? `\n--- stderr ---\n${result.stderr}` : '';

  return {
    content: [{
      type: 'text' as const,
      text: `${header}${stdoutBlock}${stderrBlock}`,
    }],
  };
}
