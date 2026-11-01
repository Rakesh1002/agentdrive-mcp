#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient, TOOLS, SERVER_INSTRUCTIONS } from './registry.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { projectKeyFor, scopeProjectKey } from './project.js';
import { CONNECT_DESCRIPTION, CONNECT_INSTRUCTIONS, createConnector, spawnInit, waitFor } from './connect.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

// Mirrors configDir() in packages/cli/src/lib/config.ts so a key saved by
// `adrive auth login` works without exporting AGENTDRIVE_API_KEY.
interface CliConfigFile {
  api_key?: string;
  api_url?: string;
  preferences?: { private_workspace?: boolean };
}

const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'agentdrive');

function readCliConfig(): CliConfigFile {
  try {
    return JSON.parse(readFileSync(join(CONFIG_DIR, 'config.json'), 'utf8')) as CliConfigFile;
  } catch {
    return {};
  }
}

function buildClient(): ApiClient | undefined {
  const fileConfig = readCliConfig();
  const cliConfig = process.env.AGENTDRIVE_API_KEY ? {} : fileConfig;
  const apiKey = process.env.AGENTDRIVE_API_KEY || cliConfig.api_key;
  if (!apiKey) return undefined;
  return new ApiClient({
    baseUrl: process.env.AGENTDRIVE_API_URL || cliConfig.api_url || 'https://app.agentdrive.sh',
    apiKey,
    agentPlatform: process.env.AGENTDRIVE_AGENT_PLATFORM || 'unknown',
    agentRole: process.env.AGENTDRIVE_AGENT_ROLE || '',
    project: scopeProjectKey(projectKeyFor(process.cwd()), !!fileConfig.preferences?.private_workspace),
  });
}

function registerTools(server: McpServer, client: ApiClient): void {
  for (const tool of TOOLS) {
    server.tool(tool.name, tool.description, tool.schema, (args) => tool.handler(client, args));
  }
}

const client = buildClient();

const server = new McpServer(
  {
    name: 'agentdrive',
    version: pkg.version,
    description: 'AgentDrive — the persistent workspace your agents share across Claude Code, Codex, Cursor, and LangGraph. Files, semantic search, run logging, cross-platform memory, and per-workspace Linux sandbox with git worktree.',
  },
  {
    instructions: client ? SERVER_INSTRUCTIONS : CONNECT_INSTRUCTIONS,
  },
);

if (client) {
  registerTools(server, client);
} else {
  const logPath = join(CONFIG_DIR, 'connect.log');
  const connect = createConnector({
    logPath,
    spawnInit: () => spawnInit(logPath),
    readLog: () => {
      try {
        return readFileSync(logPath, 'utf8');
      } catch {
        return '';
      }
    },
    probeConnected: buildClient,
    onConnected: switchOver,
  });
  const connectTool = server.tool('drive_connect', CONNECT_DESCRIPTION, async () => ({
    content: [{ type: 'text' as const, text: await connect() }],
  }));
  let switched = false;
  function switchOver(connected: ApiClient): void {
    if (switched) return;
    switched = true;
    registerTools(server, connected);
    connectTool.remove();
  }
  // The user may connect from a terminal (`adrive init`) instead of calling drive_connect.
  void waitFor(buildClient, { intervalMs: 5_000, timeoutMs: Number.POSITIVE_INFINITY }).then((c) => c && switchOver(c));
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
