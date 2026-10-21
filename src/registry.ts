import type { z } from 'zod';
import type { ApiClient } from './api-client.js';

import { driveWriteSchema, driveWrite } from './tools/drive-write.js';
import { driveReadSchema, driveRead } from './tools/drive-read.js';
import { driveListSchema, driveList } from './tools/drive-list.js';
import { driveShareSchema, driveShare } from './tools/drive-share.js';
import { driveCommentSchema, driveComment } from './tools/drive-comment.js';
import { driveFeedbackSchema, driveFeedback } from './tools/drive-feedback.js';
import { driveActivitySchema, driveActivity } from './tools/drive-activity.js';
import { driveInviteSchema, driveInvite } from './tools/drive-invite.js';
import { driveRolesSchema, driveRoles } from './tools/drive-roles.js';
import { driveOrgSchema, driveOrg } from './tools/drive-org.js';
import { driveDeleteSchema, driveDelete } from './tools/drive-delete.js';
import { driveVersionsSchema, driveVersions } from './tools/drive-versions.js';
import { driveSearchSchema, driveSearch } from './tools/drive-search.js';
import { driveRecallSchema, driveRecall } from './tools/drive-recall.js';
import { driveLogRunSchema, driveLogRun } from './tools/drive-log-run.js';
import { driveContextSchema, driveContext } from './tools/drive-context.js';
import { driveSandboxCloneSchema, driveSandboxClone } from './tools/drive-sandbox-clone.js';
import { driveSandboxExecSchema, driveSandboxExec } from './tools/drive-sandbox-exec.js';
import { driveSandboxReadSchema, driveSandboxRead } from './tools/drive-sandbox-read.js';
import { driveSandboxCommitSchema, driveSandboxCommit } from './tools/drive-sandbox-commit.js';
import { driveSessionsSchema, driveSessions } from './tools/drive-sessions.js';
import { driveResumeSchema, driveResume } from './tools/drive-resume.js';

export interface ToolResult {
  // Index signature mirrors the MCP SDK's CallToolResult so a registry entry's
  // handler return type satisfies server.tool(...) without importing the SDK here.
  [x: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  // args is validated against `schema` by the transport layer before this runs,
  // so each handler can safely treat it as its declared shape.
  handler: (client: ApiClient, args: any) => Promise<ToolResult>;
}

// Shared by every MCP-aware host. Stdio and the hosted Streamable-HTTP server
// surface the same guidance via the MCP `instructions` field at session start.
export const SERVER_INSTRUCTIONS = `AgentDrive — cross-agent artifact workspace with provenance for multi-agent workflows.

Reach for these tools without waiting to be asked:

- **Session start:** call \`drive_context\` with a short summary of the
  current task. Returns the most relevant artifacts and last_run
  summaries from prior agents' work in the same workspace, each with
  an \`attribution\` block explaining *why* it was surfaced.
- **Continuing earlier work:** if the user is picking up where a prior
  session left off (or a SessionStart note mentions prior sessions),
  call \`drive_sessions\` to list this project's recent sessions across
  harnesses, then \`drive_resume\` to load one's handoff brief.
- **Cross-agent recall:** call \`drive_search\` (semantic) when the
  user asks "what did Codex / Cursor / the last session do?"
- **Saving work:** call \`drive_write\` for any artifact worth keeping
  so the next agent in the chain can read it back.
- **Provenance:** call \`drive_log_run\` at the end of meaningful
  work so the cross-agent timeline stays accurate.

Privacy: if the user has Private Workspace on, written content is
encrypted client-side; the AgentDrive server only stores ciphertext.`;

// Single source of truth for the 22 tools. Consumed by the stdio server
// (packages/mcp-server/src/index.ts) and the hosted Streamable-HTTP endpoint
// (apps/worker/src/routes/mcp.ts).
export const TOOLS: ToolDef[] = [
  { name: 'drive_write', description: 'Write a markdown file to a workspace. Creates or updates the file with automatic versioning.', schema: driveWriteSchema, handler: driveWrite },
  { name: 'drive_read', description: "Read a file's content from a workspace.", schema: driveReadSchema, handler: driveRead },
  { name: 'drive_list', description: 'List files in a workspace, optionally filtered by path prefix.', schema: driveListSchema, handler: driveList },
  { name: 'drive_share', description: 'Generate a share link for a workspace or specific file. Optionally email-gate the link so only a specific person can access it. Humans open this link to view, comment, or edit files.', schema: driveShareSchema, handler: driveShare },
  { name: 'drive_comment', description: 'Add a comment to a file.', schema: driveCommentSchema, handler: driveComment },
  { name: 'drive_feedback', description: 'Read human comments on a file. Use this to check if humans have left feedback.', schema: driveFeedbackSchema, handler: driveFeedback },
  { name: 'drive_activity', description: 'Get recent activity in a workspace (file writes, comments, shares).', schema: driveActivitySchema, handler: driveActivity },
  { name: 'drive_invite', description: 'Invite a human to your organization by email. They will receive a verification code to join.', schema: driveInviteSchema, handler: driveInvite },
  { name: 'drive_roles', description: 'Manage per-workspace role delegation. Assign, list, or remove access for specific emails (view/comment/edit).', schema: driveRolesSchema, handler: driveRoles },
  { name: 'drive_org', description: 'View your organization details: agents, members, plan, and usage.', schema: driveOrgSchema, handler: driveOrg },
  { name: 'drive_delete', description: 'Delete a file from a workspace.', schema: driveDeleteSchema, handler: driveDelete },
  { name: 'drive_versions', description: 'View version history for a file in a workspace.', schema: driveVersionsSchema, handler: driveVersions },
  { name: 'drive_search', description: "Semantic search across your org's artifacts in AgentDrive. Returns the top-N most relevant files. Use this BEFORE writing similar artifacts to avoid duplication and surface prior context.", schema: driveSearchSchema, handler: driveSearch },
  { name: 'drive_recall', description: 'Recall persistent facts and preferences your agents have written. In v1 this returns semantic search results across artifacts; v1.5 will narrow to auto-extracted facts (preferences, decisions, key entities).', schema: driveRecallSchema, handler: driveRecall },
  { name: 'drive_log_run', description: "Log an agent run to AgentDrive's provenance store. Captures task, status, referenced/produced artifacts, and cross-platform identity (which agent on which tool). Used for retrospective context retrieval and team-wide audit.", schema: driveLogRunSchema, handler: driveLogRun },
  { name: 'drive_context', description: 'Auto-pull the most relevant artifacts from prior agent sessions for the task you are about to do. Combines semantic relevance with recency. Call this at the START of any non-trivial task to ground the agent in prior context — replaces manual copy-paste of artifacts between sessions.', schema: driveContextSchema, handler: driveContext },
  { name: 'drive_sessions', description: 'List recent agent sessions for this project across harnesses (Claude Code, Codex, OpenCode, Gemini CLI, Cursor), newest first. Use to find prior work to continue.', schema: driveSessionsSchema, handler: driveSessions },
  { name: 'drive_resume', description: "Load a compact handoff brief (goal, files touched, recent turns) from a prior session, by default the latest one from a different harness, so you can continue that work.", schema: driveResumeSchema, handler: driveResume },
  { name: 'drive_sandbox_clone', description: '[EXPERIMENTAL] Clone a git repo into a per-workspace Linux sandbox. Requires Cloudflare Containers on the AgentDrive worker; gracefully degrades to a 503 with "sandbox not configured" otherwise.', schema: driveSandboxCloneSchema, handler: driveSandboxClone },
  { name: 'drive_sandbox_exec', description: '[EXPERIMENTAL] Run a shell command inside the per-workspace Linux sandbox. Captures stdout/stderr (64 KB cap), exit code, duration. Requires Cloudflare Containers; degrades to 503 otherwise.', schema: driveSandboxExecSchema, handler: driveSandboxExec },
  { name: 'drive_sandbox_read', description: '[EXPERIMENTAL] Read a file from the per-workspace sandbox filesystem (build artifacts, test output, logs). Requires Cloudflare Containers; degrades to 503 otherwise.', schema: driveSandboxReadSchema, handler: driveSandboxRead },
  { name: 'drive_sandbox_commit', description: '[EXPERIMENTAL] Stage + commit the current sandbox worktree. Surfaces as an AgentDrive artifact at commits/<sha>.json. Requires Cloudflare Containers; degrades to 503 otherwise.', schema: driveSandboxCommitSchema, handler: driveSandboxCommit },
];

export { ApiClient } from './api-client.js';
export type { ApiClientConfig } from './api-client.js';
