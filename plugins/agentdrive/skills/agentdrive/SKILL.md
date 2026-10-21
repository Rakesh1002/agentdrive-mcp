---
name: agentdrive
description: Cross-agent session memory and artifact workspace. Use when the user wants to continue work another agent session started (Claude Code, Codex, OpenCode, Gemini CLI, Cursor), asks what an earlier session did, needs prior context for a task, or wants to save an artifact for their other agents.
---

# AgentDrive

AgentDrive captures the user's agent sessions in the background and makes any
of them resumable from any harness. Prefer the `drive_*` MCP tools; fall back
to the `adrive` CLI when they are not available.

## Sessions

- "Continue where I left off", "pick up the Codex session", "what was I
  doing?": call `drive_resume` (optionally with `session_id` or
  `platform`). Summarize the handoff in a few bullets, check the files it
  mentions on disk, then continue the work.
- "What sessions do I have?", "what did Cursor do today?": call
  `drive_sessions` (filters: `project`, `platform`, `limit`).

Both default to the current project.

## Context and search

- Starting a non-trivial task: call `drive_context` with a one-line summary
  of the task to get relevant artifacts and runs from earlier work.
- Looking for something specific: call `drive_search`.

When citing a result, say why it surfaced (`attribution.reasons`) and mention
the `last_run` task when present.

## Saving work

After producing a file worth sharing with the user's other agents, call
`drive_write`. Transcripts and files git doesn't track are already captured
automatically when the user has capture on, so don't re-upload them.

## CLI fallback

```
adrive resume [session-id]   # print a session handoff
adrive resume --list         # list recent sessions
adrive context "<task>"      # relevant artifacts for a task
adrive search "<query>"      # semantic search
adrive push <file>           # save an artifact
```

If `adrive` says the user is not logged in, ask them to run `adrive init`
(or `/agentdrive:login` in Claude Code). Never guess credentials.

## Privacy

Respect `adrive privacy`. With "Private workspace" on, content is encrypted
on the device and the server stores only ciphertext.
