import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveLogRunSchema = {
  task: z.string().min(1).describe('What the agent did or is doing (free text)'),
  status: z.enum(['success', 'failure', 'partial', 'in_progress']).optional().describe('Run outcome (default success)'),
  run_id: z.string().optional().describe('Existing run ID to update; omit to let server allocate'),
  artifacts_referenced: z.array(z.string()).optional().describe('Paths of artifacts the run read'),
  artifacts_produced: z.array(z.string()).optional().describe('Paths of artifacts the run wrote'),
  duration_ms: z.number().int().nonnegative().optional().describe('Wall-clock duration in milliseconds'),
  metadata: z.record(z.unknown()).optional().describe('Free-form key/value metadata'),
};

export async function driveLogRun(client: ApiClient, args: {
  task: string;
  status?: 'success' | 'failure' | 'partial' | 'in_progress';
  run_id?: string;
  artifacts_referenced?: string[];
  artifacts_produced?: string[];
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}) {
  const result = await client.logRun({
    task: args.task,
    status: args.status ?? 'success',
    run_id: args.run_id,
    artifacts_referenced: args.artifacts_referenced,
    artifacts_produced: args.artifacts_produced,
    duration_ms: args.duration_ms,
    metadata: args.metadata,
  });
  return {
    content: [{
      type: 'text' as const,
      text: `Run logged: ${result.run_id} (${new Date(result.created_at).toISOString()})`,
    }],
  };
}
