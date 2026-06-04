import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export const driveInviteSchema = {
  email: z.string().describe('Email address of the human to invite to your organization'),
  role: z.enum(['owner', 'admin', 'member']).default('member').describe('Role in the organization (default: member)'),
};

export async function driveInvite(client: ApiClient, args: {
  email: string;
  role: 'owner' | 'admin' | 'member';
}) {
  const member = await client.inviteMember(args.email, args.role);

  return {
    content: [{
      type: 'text' as const,
      text: `Invited ${args.email} as ${args.role}. They'll receive an email with a verification code to join the organization.`,
    }],
  };
}
