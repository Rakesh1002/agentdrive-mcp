---
description: Log in to AgentDrive and connect your other agent harnesses
---

Log the user in to AgentDrive and connect their other agent tools.

1. Run `npx -y @adrive/cli init --yes` in the shell. It opens a browser to sign in and waits until that finishes (tell the user to complete it there), then connects every installed agent tool: Codex, OpenCode, Gemini CLI, Cursor and MCP clients.
2. Relay init's summary to the user, including any manual step it lists.
