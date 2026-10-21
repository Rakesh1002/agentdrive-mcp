import { z } from 'zod';
import type { AgentRunRecord, ApiClient } from '../api-client.js';
import { relativeTime } from './drive-context.js';
import { sessionActivityAt } from '../session.js';

export const driveSessionsSchema = {
  project: z.string().regex(/^[a-z0-9._-]{1,200}$/).optional().describe('Project key; defaults to the project of the current working directory'),
  platform: z.string().optional().describe('Only sessions from this harness (claude-code, codex, opencode, gemini-cli, cursor)'),
  limit: z.number().int().positive().max(50).optional().describe('Max sessions to return (default 10, max 50)'),
};

export function noProjectResult() {
  return {
    content: [{
      type: 'text' as const,
      text: 'No project key is known for this session. Pass `project` (e.g. github.com__owner__repo).',
    }],
  };
}

function sessionTitle(run: AgentRunRecord): string {
  const title = run.metadata.title;
  return typeof title === 'string' && title ? title : run.task;
}

export async function driveSessions(client: ApiClient, args: {
  project?: string;
  platform?: string;
  limit?: number;
}) {
  const project = args.project ?? client.project;
  if (!project) return noProjectResult();

  const { items } = await client.listRuns({ project, platform: args.platform, limit: args.limit ?? 10 });
  if (items.length === 0) {
    return { content: [{ type: 'text' as const, text: `No prior sessions for project ${project}.` }] };
  }

  const now = Date.now();
  const lines = items.map((r) => {
    const age = relativeTime(now - sessionActivityAt(r));
    const uploaded = typeof r.metadata.files_uploaded === 'number' ? r.metadata.files_uploaded : r.artifacts_produced.length;
    return `${age} · ${r.agent_platform} · ${sessionTitle(r)} · id=${r.run_id} · files_uploaded=${uploaded}`;
  });
  return {
    content: [{
      type: 'text' as const,
      text: `Sessions for ${project} (newest first):\n${lines.join('\n')}\n\nCall drive_resume with session_id to load one.`,
    }],
  };
}
