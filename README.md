# AgentDrive MCP Server

The official [Model Context Protocol](https://modelcontextprotocol.io) server for
**[AgentDrive](https://agentdrive.sh)** — a cross-agent artifact workspace with
provenance and portable storage across Claude Code, Codex, Cursor, LangGraph, and
any MCP-aware host.

Give your agents a shared, persistent workspace: files with versioning, semantic
recall over everything prior agents produced, run logging, and cross-agent
attribution — so the next session (on any tool) picks up where the last one left off.

- **Website:** https://agentdrive.sh
- **Docs:** https://agentdrive.sh/docs
- **npm:** [`@adrive/mcp-server`](https://www.npmjs.com/package/@adrive/mcp-server)
- **Hosted endpoint:** `https://mcp.agentdrive.sh/mcp`

## Claude Code plugin

This repo is also the Claude Code plugin marketplace. The plugin captures every
session in the background and resumes it from Codex, OpenCode, Gemini CLI, or Cursor:

```
/plugin install agentdrive --marketplace Rakesh1002/agentdrive-mcp
```

On Claude Code older than 2.1.275, run `/plugin marketplace add Rakesh1002/agentdrive-mcp`
then `/plugin install agentdrive@agentdrive`. Sign in with `/agentdrive:login`.

## Get an API key (free)

Create one at **https://app.agentdrive.sh** — no credit card. The free tier
(1 workspace, 1 GB storage, 10k embeddings) is free indefinitely.

## Two ways to connect

### 1. Hosted (no install) — Streamable HTTP

Point any MCP client that supports remote servers at the hosted endpoint and pass
your key as a bearer token:

```
URL:    https://mcp.agentdrive.sh/mcp
Header: Authorization: Bearer agentdrive_live_xxx
```

Or install in one click via **[Smithery](https://smithery.ai/servers/rakesh1002/agentdrive)**.

### 2. Local (stdio) — via npx

```jsonc
{
  "mcpServers": {
    "agentdrive": {
      "command": "npx",
      "args": ["-y", "@adrive/mcp-server"],
      "env": {
        "AGENTDRIVE_API_KEY": "agentdrive_live_xxx"
      }
    }
  }
}
```

Add that block to your host's MCP config:

- **Claude Desktop:** `claude_desktop_config.json`
- **Cursor:** `~/.cursor/mcp.json`
- **Claude Code:** `claude mcp add agentdrive -- npx -y @adrive/mcp-server` (set `AGENTDRIVE_API_KEY` in env)
- **Codex / Cline / Continue / Zed:** the standard `mcpServers` block above

The fastest path is the AgentDrive installer, which auto-wires every detected host:

```sh
curl -fsSL agentdrive.sh/install | sh
```

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `AGENTDRIVE_API_KEY` | yes | — | Your AgentDrive API key (`agentdrive_live_...`). |
| `AGENTDRIVE_API_URL` | no | `https://app.agentdrive.sh` | Override the API endpoint (self-hosted worker). |
| `AGENTDRIVE_AGENT_PLATFORM` | no | `claude-code` | Which agent runtime is calling — drives cross-agent provenance. One of `claude-code`, `codex`, `cursor`, `langgraph`, `crewai`, `autogen`, `cline`, `continue`, `zed`, `unknown`. |
| `AGENTDRIVE_AGENT_ROLE` | no | — | Free-text role label (e.g. `planner`, `reviewer`) to distinguish multiple agents on the same platform. |

## Tools

20 tools across files, memory, collaboration, org, and provenance.

| Tool | Category | Description |
|---|---|---|
| `drive_context` | memory | Auto-pull the most relevant prior artifacts for the task you're starting. |
| `drive_search` | memory | Semantic search across your org's artifacts. |
| `drive_recall` | memory | Recall persistent facts/preferences agents have written. |
| `drive_write` | files | Write a markdown file (auto-versioned). |
| `drive_read` | files | Read a file's content. |
| `drive_list` | files | List files in a workspace. |
| `drive_delete` | files | Delete a file. |
| `drive_versions` | files | View a file's version history. |
| `drive_share` | collaboration | Generate a (optionally email-gated) share link. |
| `drive_comment` | collaboration | Comment on a file. |
| `drive_feedback` | collaboration | Read human comments on a file. |
| `drive_activity` | provenance | Recent workspace activity (writes, comments, shares). |
| `drive_log_run` | provenance | Log an agent run (task, status, artifacts, identity). |
| `drive_invite` | org | Invite a human to your org by email. |
| `drive_roles` | org | Assign/list/remove per-workspace access by email. |
| `drive_org` | org | View org details: agents, members, plan, usage. |
| `drive_sandbox_clone` | sandbox (experimental) | Clone a git repo into a per-workspace Linux sandbox. |
| `drive_sandbox_exec` | sandbox (experimental) | Run a shell command in the sandbox. |
| `drive_sandbox_read` | sandbox (experimental) | Read a file from the sandbox filesystem. |
| `drive_sandbox_commit` | sandbox (experimental) | Stage + commit the sandbox worktree. |

The `drive_sandbox_*` tools require the Cloudflare Containers plan on the AgentDrive
worker and degrade cleanly to a "not configured" message otherwise.

## Why AgentDrive

Agents lose context at every session boundary and every tool switch. AgentDrive is
the shared substrate: one workspace, every agent, full provenance. Write once with
Claude Code; recall it from Cursor; hand off to Codex — each call is attributed to
the right principal and platform.

## Develop

```sh
npm install
npm run build      # tsc -> dist/
npm test           # vitest
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
