---
description: Log in to AgentDrive and connect your other agent harnesses
---

Log the user in to AgentDrive and connect their other agent tools.

1. Run `npx -y @adrive/cli auth login` in the shell. It opens a browser for sign-in and waits until it completes; tell the user to finish signing in there.
2. When it succeeds, run `npx -y @adrive/cli init --yes` to wire AgentDrive into Codex, OpenCode, Gemini CLI, and Cursor where they are installed.
3. Relay init's summary to the user, including any one-time step it asks for (such as approving the hooks in Codex via /hooks).
