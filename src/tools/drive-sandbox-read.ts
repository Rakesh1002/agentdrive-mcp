import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveSandboxReadSchema = {
  workspace_id: z.string().describe('Workspace whose sandbox to read from'),
  path: z.string().describe('Path inside the sandbox (e.g., src/index.ts or /tmp/build.log)'),
};

export async function driveSandboxRead(client: ApiClient, args: {
  workspace_id: string;
  path: string;
}) {
  const file = await client.sandboxRead(args.workspace_id, args.path);
  const note = file.truncated ? `\n\n[content truncated; total ${file.size} bytes]` : '';
  return {
    content: [{
      type: 'text' as const,
      text: `${args.path} (${file.size} bytes)\n\n${file.content}${note}`,
    }],
  };
}
