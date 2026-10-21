import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeRemote, projectKeyFor, scopeProjectKey } from '../src/project.js';

describe('normalizeRemote', () => {
  it.each([
    ['git@github.com:Owner/Repo.git', 'github.com__owner__repo'],
    ['https://user@github.com/Owner/Repo.git', 'github.com__owner__repo'],
    ['https://github.com/Owner/Repo', 'github.com__owner__repo'],
    ['ssh://git@GitHub.com:22/Owner/Repo.git', 'github.com__owner__repo'],
    ['git@gitlab.com:group/sub group/proj.git', 'gitlab.com__group__sub-group__proj'],
  ])('%s -> %s', (url, expected) => {
    expect(normalizeRemote(url)).toBe(expected);
  });

  it('returns null for unparseable remotes', () => {
    expect(normalizeRemote('/srv/git/repo.git')).toBeNull();
    expect(normalizeRemote('')).toBeNull();
  });
});

describe('projectKeyFor', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'adrive-project-')));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function git(cwd: string, ...args: string[]) {
    execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
  }

  it('uses the normalized origin remote when present', () => {
    const repo = join(root, 'with-remote');
    mkdirSync(repo);
    git(repo, 'init', '-q');
    git(repo, 'remote', 'add', 'origin', 'git@github.com:Owner/Repo.git');
    expect(projectKeyFor(repo)).toBe('github.com__owner__repo');
  });

  it('falls back to toplevel basename + hash without a remote', () => {
    const repo = join(root, 'No Remote');
    mkdirSync(join(repo, 'sub'), { recursive: true });
    git(repo, 'init', '-q');
    expect(projectKeyFor(join(repo, 'sub'))).toMatch(/^no-remote-[0-9a-f]{8}$/);
    expect(projectKeyFor(join(repo, 'sub'))).toBe(projectKeyFor(repo));
  });

  it('uses a local key outside any git repo and never throws', () => {
    const plain = join(root, 'plain');
    mkdirSync(plain);
    expect(projectKeyFor(plain)).toMatch(/^local__plain-[0-9a-f]{8}$/);
    expect(projectKeyFor(join(root, 'does-not-exist'))).toMatch(/^local__does-not-exist-[0-9a-f]{8}$/);
  });
});

describe('scopeProjectKey', () => {
  it('hides the repo name behind a stable hash only in a private workspace', () => {
    expect(scopeProjectKey('github.com__acme__widget', false)).toBe('github.com__acme__widget');
    const hidden = scopeProjectKey('github.com__acme__widget', true);
    expect(hidden).toMatch(/^p-[0-9a-f]{16}$/);
    expect(hidden).toMatch(/^[a-z0-9._-]{1,200}$/);
    expect(scopeProjectKey('github.com__acme__widget', true)).toBe(hidden);
    expect(scopeProjectKey('github.com__acme__other', true)).not.toBe(hidden);
  });
});
