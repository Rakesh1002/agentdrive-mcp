import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnector, extractSignInUrl, waitFor } from '../src/connect.js';

describe('extractSignInUrl', () => {
  it('finds the cli-auth URL in CLI output, colored or not', () => {
    const plain = 'Opening browser to log in...\n  https://app.agentdrive.sh/cli-auth?id=abc123\n  If the browser does not open';
    expect(extractSignInUrl(plain)).toBe('https://app.agentdrive.sh/cli-auth?id=abc123');
    expect(extractSignInUrl('  \x1b[36mhttps://app.agentdrive.sh/cli-auth?id=x-9\x1b[39m\n')).toBe(
      'https://app.agentdrive.sh/cli-auth?id=x-9',
    );
  });

  it('returns undefined when no sign-in URL has been printed', () => {
    expect(extractSignInUrl('npm warn exec The following package was not found\nhttps://agentdrive.sh')).toBeUndefined();
  });
});

describe('waitFor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gives up with undefined after the timeout', async () => {
    const probe = vi.fn(() => undefined);
    const result = waitFor(probe, { intervalMs: 2_000, timeoutMs: 10_000 });
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await result).toBeUndefined();
    expect(probe).toHaveBeenCalledTimes(6);
  });
});

describe('createConnector', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    let log = '';
    let apiKey: string | undefined;
    let finishInit: () => void = () => {};
    const spawnInit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishInit = resolve;
        }),
    );
    const onConnected = vi.fn();
    const connect = createConnector({
      logPath: '/cfg/connect.log',
      spawnInit,
      readLog: () => log,
      probeConnected: () => (apiKey ? { apiKey } : undefined),
      onConnected,
    });
    return {
      connect,
      spawnInit,
      onConnected,
      setLog: (text: string) => (log = text),
      setKey: (key: string) => (apiKey = key),
      finishInit: () => finishInit(),
    };
  }

  it('returns the sign-in URL once the CLI prints it', async () => {
    const t = setup();
    const result = t.connect();
    await vi.advanceTimersByTimeAsync(500);
    t.setLog('Opening browser to log in...\n  https://app.agentdrive.sh/cli-auth?id=abc\n');
    await vi.advanceTimersByTimeAsync(500);
    const text = await result;
    expect(text).toContain('A browser window was opened');
    expect(text).toContain('https://app.agentdrive.sh/cli-auth?id=abc');
  });

  it('points at the log when no URL shows up in time', async () => {
    const t = setup();
    const result = t.connect();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(await result).toContain('/cfg/connect.log');
  });

  it('does not spawn a second init while one is in flight, and respawns after it exits', async () => {
    const t = setup();
    t.setLog('https://app.agentdrive.sh/cli-auth?id=abc');
    await t.connect();
    const second = await t.connect();
    expect(t.spawnInit).toHaveBeenCalledTimes(1);
    expect(second).toContain('already in progress');
    expect(second).toContain('cli-auth?id=abc');

    t.finishInit();
    await vi.advanceTimersByTimeAsync(0);
    await t.connect();
    expect(t.spawnInit).toHaveBeenCalledTimes(2);
  });

  it('calls onConnected once when the API key lands in the config', async () => {
    const t = setup();
    t.setLog('https://app.agentdrive.sh/cli-auth?id=abc');
    await t.connect();
    await t.connect();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(t.onConnected).not.toHaveBeenCalled();

    t.setKey('agentdrive_live_k');
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.onConnected).toHaveBeenCalledTimes(1);
    expect(t.onConnected).toHaveBeenCalledWith({ apiKey: 'agentdrive_live_k' });
  });
});
