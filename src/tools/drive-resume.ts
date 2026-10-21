import { z } from 'zod';
import type { AgentRunRecord, ApiClient } from '../api-client.js';
import { buildHandoff, isEncrypted } from '../session.js';
import { noProjectResult } from './drive-sessions.js';

export const driveResumeSchema = {
  session_id: z.string().optional().describe('Session run id from drive_sessions (e.g. codex:abc123); omit to pick the latest session from another harness'),
  platform: z.string().optional().describe('When session_id is omitted, only consider sessions from this harness'),
  max_chars: z.number().int().min(1000).max(50000).optional().describe('Handoff size budget in characters (default 12000)'),
};

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] };
}

async function pickSession(client: ApiClient, project: string, platform?: string): Promise<AgentRunRecord | undefined> {
  const { items } = await client.listRuns({ project, platform, limit: 20 });
  return items.find((r) => r.agent_platform !== client.agentPlatform) ?? items[0];
}

export async function driveResume(client: ApiClient, args: {
  session_id?: string;
  platform?: string;
  max_chars?: number;
}) {
  let run: AgentRunRecord | undefined;
  if (args.session_id) {
    run = await client.getRun(args.session_id);
  } else {
    if (!client.project) return noProjectResult();
    run = await pickSession(client, client.project, args.platform);
    if (!run) return text(`No prior sessions for project ${client.project}.`);
  }

  const transcriptPath = run.metadata.transcript_path;
  if (typeof transcriptPath !== 'string' || !run.workspace_id) {
    return text(`Session ${run.run_id} has no uploaded transcript (missing metadata.transcript_path or workspace_id).`);
  }

  const file = await client.readFileByPath(run.workspace_id, transcriptPath);
  if (isEncrypted(file.content)) {
    return text(`This session is encrypted client-side; run \`adrive resume ${run.run_id}\` in a shell to view it.`);
  }
  return text(buildHandoff(file.content, args.max_chars));
}
