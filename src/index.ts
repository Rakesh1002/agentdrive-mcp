#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient, TOOLS, SERVER_INSTRUCTIONS } from './registry.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { projectKeyFor, scopeProjectKey } from './project.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

// Mirrors configDir() in packages/cli/src/lib/config.ts so a key saved by
// `adrive auth login` works without exporting AGENTDRIVE_API_KEY.
interface CliConfigFile {
  api_key?: string;
  api_url?: string;
  preferences?: { private_workspace?: boolean };
}

function readCliConfig(): CliConfigFile {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  try {
    return JSON.parse(readFileSync(join(base, 'agentdrive', 'config.json'), 'utf8')) as CliConfigFile;
  } catch {
    return {};
  }
}

const fileConfig = readCliConfig();
const cliConfig = process.env.AGENTDRIVE_API_KEY ? {} : fileConfig;
const BASE_URL = process.env.AGENTDRIVE_API_URL || cliConfig.api_url || 'https://app.agentdrive.sh';
const API_KEY = process.env.AGENTDRIVE_API_KEY || cliConfig.api_key;
const AGENT_PLATFORM = process.env.AGENTDRIVE_AGENT_PLATFORM || 'unknown';
const AGENT_ROLE = process.env.AGENTDRIVE_AGENT_ROLE || '';

if (!API_KEY) {
  console.error('No AgentDrive API key found. Set AGENTDRIVE_API_KEY or run `adrive auth login`.');
  process.exit(1);
}

const client = new ApiClient({
  baseUrl: BASE_URL,
  apiKey: API_KEY,
  agentPlatform: AGENT_PLATFORM,
  agentRole: AGENT_ROLE,
  project: scopeProjectKey(projectKeyFor(process.cwd()), !!fileConfig.preferences?.private_workspace),
});

const server = new McpServer(
  {
    name: 'agentdrive',
    version: pkg.version,
    description: 'AgentDrive — the persistent workspace your agents share across Claude Code, Codex, Cursor, and LangGraph. Files, semantic search, run logging, cross-platform memory, and per-workspace Linux sandbox with git worktree.',
  },
  {
    instructions: SERVER_INSTRUCTIONS,
  },
);

for (const tool of TOOLS) {
  server.tool(tool.name, tool.description, tool.schema, (args) => tool.handler(client, args));
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
