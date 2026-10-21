export type SessionHarness = 'claude-code' | 'codex' | 'opencode' | 'gemini-cli' | 'cursor';

export interface SessionTool {
  name: string;
  path?: string;
  summary?: string;
}

export interface SessionTurn {
  role: string;
  text: string;
  ts?: string;
  tools?: SessionTool[];
}

export interface SessionDoc {
  harness: SessionHarness;
  sessionId: string;
  project: string;
  cwd?: string;
  title?: string;
  updatedAt: string;
  turns: SessionTurn[];
  filesTouched: string[];
}

// Must stay in sync with ENCRYPTED_PREFIX in packages/cli/src/lib/crypto.ts.
const ENCRYPTED_PREFIX = 'agentdrive-encrypted:v0:';
const DEFAULT_HANDOFF_CHARS = 12000;
const GOAL_CHARS = 1500;
const MAX_HANDOFF_FILES = 50;
const TURN_HEADER = /^## ([a-z0-9_-]+)(?: {2}_\((.*)\)_)?$/;
const TOOL_LINE = '> tool: ';
// Turn text lines that could be read as a turn header or tool line get a
// leading backslash so the parser never splits inside a turn body.
const COLLIDING_LINE = /^\\*(## |> tool: )/;

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 128);
}

function roleSlug(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'system';
}

export function isEncrypted(content: string): boolean {
  return content.startsWith(ENCRYPTED_PREFIX);
}

export function sessionRunId(harness: SessionHarness, sessionId: string): string {
  return `${harness}:${sanitizeId(sessionId)}`;
}

export function sessionPath(project: string, harness: SessionHarness, sessionId: string): string {
  return `sessions/${project}/${harness}/${sanitizeId(sessionId)}.md`;
}

// Project listings are ordered by last activity, so ages must be shown from it too.
export function sessionActivityAt(run: { created_at: number; updated_at?: number; metadata?: Record<string, unknown> }): number {
  const at = run.metadata?.last_activity_at;
  return typeof at === 'number' ? at : run.updated_at ?? run.created_at;
}

export function renderSession(doc: SessionDoc): string {
  const out: string[] = [`# Session — ${doc.harness} / ${oneLine(doc.sessionId)}`, ''];
  out.push(`Project: ${oneLine(doc.project)}`);
  if (doc.cwd) out.push(`Cwd: ${oneLine(doc.cwd)}`);
  if (doc.title) out.push(`Title: ${oneLine(doc.title)}`);
  out.push(`Updated: ${oneLine(doc.updatedAt)}`);
  out.push(`Turns: ${doc.turns.length}`);
  out.push('', 'Files touched:');
  for (const f of doc.filesTouched) out.push(`- ${oneLine(f)}`);

  for (const turn of doc.turns) {
    out.push('', turn.ts ? `## ${roleSlug(turn.role)}  _(${oneLine(turn.ts)})_` : `## ${roleSlug(turn.role)}`, '');
    const text = turn.text.replace(/\r\n?/g, '\n').trim();
    if (text) {
      for (const line of text.split('\n')) out.push(COLLIDING_LINE.test(line) ? `\\${line}` : line);
    }
    if (turn.tools && turn.tools.length > 0) {
      if (text) out.push('');
      for (const tool of turn.tools) {
        const detail = tool.path ?? tool.summary;
        out.push(`${TOOL_LINE}${oneLine(tool.name)}${detail ? ` ${oneLine(detail)}` : ''}`);
      }
    }
  }
  return `${out.join('\n')}\n`;
}

interface ParsedTurn {
  role: string;
  lines: string[];
}

interface ParsedSession {
  harness?: string;
  sessionId?: string;
  meta: string[];
  files: string[];
  turns: ParsedTurn[];
}

function parseSession(markdown: string): ParsedSession {
  const parsed: ParsedSession = { meta: [], files: [], turns: [] };
  let current: ParsedTurn | null = null;
  let inFiles = false;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const header = TURN_HEADER.exec(line);
    if (header) {
      current = { role: header[1], lines: [line] };
      parsed.turns.push(current);
      continue;
    }
    if (current) {
      current.lines.push(line);
      continue;
    }
    const title = /^# Session — (\S+) \/ (.+)$/.exec(line);
    if (title) {
      parsed.harness = title[1];
      parsed.sessionId = title[2];
    } else if (line === 'Files touched:') {
      inFiles = true;
    } else if (inFiles && line.startsWith('- ')) {
      parsed.files.push(line.slice(2));
    } else if (/^(Project|Cwd|Title|Updated|Turns): /.test(line)) {
      parsed.meta.push(line);
    }
  }
  return parsed;
}

function turnBody(turn: ParsedTurn): string {
  return turn.lines
    .slice(1)
    .filter((l) => !l.startsWith(TOOL_LINE))
    .join('\n')
    .trim();
}

function turnBlock(turn: ParsedTurn): string {
  const [header, ...rest] = turn.lines;
  return [`#${header}`, ...rest].join('\n').trim();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 3)}...`;
}

export interface HandoffUploads {
  workspaceId: string;
  fileIds: string[];
}

function listSection(heading: string, lead: string, items: string[], cap: number): string {
  const shown = items.slice(0, cap).map((item) => `- ${item}`);
  if (items.length > cap) shown.push(`- (+${items.length - cap} more)`);
  return `## ${heading}\n\n${lead}${shown.join('\n')}`;
}

export function buildHandoff(markdown: string, maxChars: number = DEFAULT_HANDOFF_CHARS, uploads?: HandoffUploads): string {
  const session = parseSession(markdown);
  const from = session.harness ?? 'prior';
  const intro = `Handoff from a ${from} session${session.sessionId ? ` (${session.sessionId})` : ''}. Continue this work; verify file state on disk before assuming it.`;

  const firstUser = session.turns.find((t) => t.role === 'user');
  const goal = firstUser ? turnBody(firstUser) : '';
  const goalChars = Math.min(GOAL_CHARS, Math.floor(maxChars / 8));
  const head = (cap: number): string => {
    const sections: string[] = [intro];
    if (session.meta.length > 0) sections.push(session.meta.join('\n'));
    if (goal) sections.push(`## Goal\n\n${truncate(goal, goalChars)}`);
    if (session.files.length > 0) sections.push(listSection('Files touched', '', session.files, cap));
    if (uploads && uploads.fileIds.length > 0) {
      sections.push(
        listSection(
          'Uploaded files',
          `Copies of files this session wrote, in workspace ${uploads.workspaceId}. If they are not on disk here, read each with drive_read (workspace_id ${uploads.workspaceId}, file_id below):\n\n`,
          uploads.fileIds,
          cap,
        ),
      );
    }
    return sections.join('\n\n');
  };
  // The lists give way first, so a small budget still carries the recent turns.
  let cap = MAX_HANDOFF_FILES;
  let fixedHead = head(cap);
  while (cap > 0 && fixedHead.length > maxChars / 2) fixedHead = head(--cap);

  if (session.turns.length === 0) {
    const fixed = `${fixedHead}\n\n## Transcript (tail)\n\n`;
    const body = markdown.trim();
    return (fixed + body.slice(Math.max(0, body.length - (maxChars - fixed.length)))).slice(0, maxChars);
  }

  const fixed = `${fixedHead}\n\n## Recent turns\n\n`;
  const markerReserve = 64;
  let remaining = maxChars - fixed.length - markerReserve;
  const picked: string[] = [];
  for (let i = session.turns.length - 1; i >= 0 && remaining > 0; i--) {
    const block = turnBlock(session.turns[i]);
    if (block.length + 2 <= remaining) {
      picked.unshift(block);
      remaining -= block.length + 2;
      continue;
    }
    if (picked.length === 0) {
      const [header, ...rest] = block.split('\n');
      const prefix = `${header}\n\n[... turn truncated ...]\n`;
      const keep = remaining - prefix.length;
      if (keep > 0) {
        const body = rest.join('\n');
        picked.unshift(prefix + body.slice(body.length - keep));
      }
    }
    break;
  }

  const omitted = session.turns.length - picked.length;
  const marker = omitted > 0 ? `[... ${omitted} earlier turns omitted ...]\n\n` : '';
  return `${fixed}${marker}${picked.join('\n\n')}`.slice(0, maxChars);
}
