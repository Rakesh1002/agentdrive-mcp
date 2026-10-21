---
description: Resume an AgentDrive session from any agent harness
argument-hint: "[session-id]"
---

Resume earlier agent work from AgentDrive.

1. Call the `drive_resume` MCP tool. If a session id was given ($ARGUMENTS), pass it as `session_id`; otherwise call it with no arguments to get the most recent session for this project.
2. Summarize the handoff for the user in 3-5 bullets: the goal, what is done, what is left, and any open questions.
3. Before relying on the handoff, check the current state on disk of the files it mentions; the work may have changed since that session ended.
4. Continue the work from where it stopped.

If the `drive_resume` tool is not available, run `adrive resume` in the shell (add the session id if one was given) and use its output as the handoff.
