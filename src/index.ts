#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient, TOOLS, SERVER_INSTRUCTIONS } from './registry.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const BASE_URL = process.env.AGENTDRIVE_API_URL || 'https://app.agentdrive.sh';
const API_KEY = process.env.AGENTDRIVE_API_KEY;
const AGENT_PLATFORM = process.env.AGENTDRIVE_AGENT_PLATFORM || 'claude-code';
const AGENT_ROLE = process.env.AGENTDRIVE_AGENT_ROLE || '';

if (!API_KEY) {
  console.error('AGENTDRIVE_API_KEY environment variable is required');
  process.exit(1);
}

const client = new ApiClient({
  baseUrl: BASE_URL,
  apiKey: API_KEY,
  agentPlatform: AGENT_PLATFORM,
  agentRole: AGENT_ROLE,
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
