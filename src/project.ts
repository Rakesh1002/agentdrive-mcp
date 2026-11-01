import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

function git(cwd: string, args: string[]): string | null {
  try {
    const out = execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function sha8(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

export function normalizeRemote(url: string): string | null {
  const trimmed = url.trim();
  let host: string;
  let path: string;
  const scp = /^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/.exec(trimmed);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }
    host = parsed.hostname;
    path = parsed.pathname;
  } else if (scp) {
    host = scp[1];
    path = scp[2];
  } else {
    return null;
  }
  const segments = path
    .replace(/\.git\/?$/, '')
    .split('/')
    .filter(Boolean)
    .map(slug);
  if (!host || segments.length === 0) return null;
  return [slug(host), ...segments].join('__');
}

// Bump whenever projectKeyFor can return a different key for the same cwd, so
// clients re-file sessions they already synced under the old key.
export const PROJECT_KEY_VERSION = 2;

export function projectKeyFor(cwd: string): string {
  const remote = git(cwd, ['config', '--get', 'remote.origin.url']);
  const normalized = remote ? normalizeRemote(remote) : null;
  if (normalized) return normalized.slice(0, 200);

  const toplevel = git(cwd, ['rev-parse', '--show-toplevel']);
  if (toplevel) return `${slug(basename(toplevel)).slice(0, 150)}-${sha8(toplevel)}`;

  // Claude Code deletes a worktree once its work lands; its sessions still belong to the parent repo.
  const parent = /^(.+?)\/\.claude\/worktrees\/[^/]+/.exec(cwd)?.[1];
  if (parent) return projectKeyFor(parent);

  return `local__${slug(basename(cwd)).slice(0, 150)}-${sha8(cwd)}`;
}

// A private workspace must not leak repo names through storage paths or the
// project index, so the key is replaced by a stable hash of itself.
export function scopeProjectKey(key: string, privateWorkspace: boolean): string {
  return privateWorkspace ? `p-${createHash('sha256').update(key).digest('hex').slice(0, 16)}` : key;
}
