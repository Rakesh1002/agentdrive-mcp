---
description: List recent AgentDrive sessions across agent harnesses
argument-hint: "[platform or project]"
---

List recent agent sessions captured by AgentDrive.

Call the `drive_sessions` MCP tool. If a filter was given ($ARGUMENTS), pass a harness name (claude-code, codex, opencode, gemini-cli, cursor) as `platform` and anything else as `project`.

Show the result as a compact list: session id, harness, project, when it was last active, and a one-line summary. Then tell the user they can pick one up with the AgentDrive resume command and its session id.

If the `drive_sessions` tool is not available, run `adrive resume --list` in the shell instead.
