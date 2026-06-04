import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveRolesSchema = {
  workspace_id: z.string().describe('Workspace ID'),
  action: z.enum(['assign', 'list', 'remove']).describe('Action: assign a role, list all roles, or remove a role'),
  email: z.string().optional().describe('Email address (required for assign/remove)'),
  permission: z.enum(['view', 'comment', 'edit']).optional().describe('Permission level (required for assign)'),
};

export async function driveRoles(client: ApiClient, args: {
  workspace_id: string;
  action: 'assign' | 'list' | 'remove';
  email?: string;
  permission?: 'view' | 'comment' | 'edit';
}) {
  if (args.action === 'list') {
    const roles = await client.getAllRoles(args.workspace_id);
    if (roles.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No roles assigned in this workspace.' }] };
    }
    const listing = roles.map(r =>
      `- ${r.email}: ${r.permission} (assigned by ${r.assigned_by} on ${r.assigned_at})`
    ).join('\n');
    return { content: [{ type: 'text' as const, text: `Workspace roles:\n${listing}` }] };
  }

  if (args.action === 'assign') {
    if (!args.email || !args.permission) {
      return { content: [{ type: 'text' as const, text: 'Error: email and permission are required for assign action.' }] };
    }
    const role = await client.assignRole(args.workspace_id, args.email, args.permission);
    return { content: [{ type: 'text' as const, text: `Assigned ${args.permission} access to ${args.email} in workspace.` }] };
  }

  if (args.action === 'remove') {
    if (!args.email) {
      return { content: [{ type: 'text' as const, text: 'Error: email is required for remove action.' }] };
    }
    await client.removeRole(args.workspace_id, args.email);
    return { content: [{ type: 'text' as const, text: `Removed ${args.email}'s role from workspace.` }] };
  }

  return { content: [{ type: 'text' as const, text: 'Unknown action.' }] };
}
