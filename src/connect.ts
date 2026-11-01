import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

export const CONNECT_INSTRUCTIONS =
  'AgentDrive is installed but not connected to an account yet, so its workspace and session tools are unavailable. ' +
  'When the user wants AgentDrive, or asks to continue work from another agent or session, offer to connect it and call `drive_connect`. ' +
  'It opens the user\'s browser to sign in once, then connects all of their installed agent tools; the AgentDrive tools appear in this session when sign-in completes.';

export const CONNECT_DESCRIPTION =
  'Connect AgentDrive to the user\'s account: opens their browser to sign in once, then connects all their installed agent tools. Call this when the user wants to use AgentDrive.';

// Unref'd so a pending sign-in watch never keeps the server alive after its client disconnects.
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

export function extractSignInUrl(log: string): string | undefined {
  // The CLI may color the URL, so stop at an ANSI escape as well as whitespace.
  return log.match(/https?:\/\/[^\s\x1b]*\/cli-auth\?id=[^\s\x1b]+/)?.[0];
}

export async function waitFor<T>(
  probe: () => T | undefined,
  { intervalMs, timeoutMs }: { intervalMs: number; timeoutMs: number },
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined || Date.now() >= deadline) return value;
    await sleep(intervalMs);
  }
}

export function spawnInit(logPath: string): Promise<void> {
  mkdirSync(dirname(logPath), { recursive: true });
  // Truncated per attempt so a sign-in URL from an earlier run is never mistaken for the current one.
  const fd = openSync(logPath, 'w');
  try {
    const child = spawn('npx', ['-y', '@adrive/cli', 'init', '--yes'], {
      detached: true,
      stdio: ['ignore', fd, fd],
      shell: process.platform === 'win32',
    });
    child.unref();
    return new Promise((resolve) => {
      child.once('exit', () => resolve());
      child.once('error', () => resolve());
    });
  } finally {
    closeSync(fd);
  }
}

export interface ConnectorDeps<C> {
  logPath: string;
  spawnInit: () => Promise<void>;
  readLog: () => string;
  probeConnected: () => C | undefined;
  onConnected: (client: C) => void;
  urlWait?: { intervalMs: number; timeoutMs: number };
  connectWait?: { intervalMs: number; timeoutMs: number };
}

export function createConnector<C>(deps: ConnectorDeps<C>): () => Promise<string> {
  const urlWait = deps.urlWait ?? { intervalMs: 250, timeoutMs: 8_000 };
  const connectWait = deps.connectWait ?? { intervalMs: 2_000, timeoutMs: 15 * 60_000 };
  let initRunning = false;
  let watching = false;

  return async () => {
    const alreadyRunning = initRunning;
    if (!initRunning) {
      initRunning = true;
      void deps.spawnInit().then(() => {
        initRunning = false;
      });
    }
    if (!watching) {
      watching = true;
      void waitFor(deps.probeConnected, connectWait).then((client) => {
        watching = false;
        if (client !== undefined) deps.onConnected(client);
      });
    }

    const url = await waitFor(() => extractSignInUrl(deps.readLog()), urlWait);
    const after =
      'After sign-in, AgentDrive connects the user\'s agent tools automatically and its tools appear in this session. ' +
      'If they do not appear, reconnect the agentdrive MCP server or start a new session.';
    if (url) {
      const lead = alreadyRunning ? 'Sign-in is already in progress.' : 'A browser window was opened to sign in to AgentDrive.';
      return `${lead} If it did not open, open this URL: ${url}\n${after}`;
    }
    return `AgentDrive sign-in is starting, but the sign-in URL is not ready yet. Progress and the URL are written to ${deps.logPath}.\n${after}`;
  };
}
