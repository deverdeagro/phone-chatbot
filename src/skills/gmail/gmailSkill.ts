import { getGmailCredentials } from './credentials';
import { searchGmail } from './imapClient';
import type { Skill } from '../types';

const MAX_RESULTS = 5;

export const gmailSkill: Skill = {
  name: 'search_gmail',
  description:
    "Search the user's connected Gmail inbox and return matching emails " +
    '(sender, subject, date, and a short preview). Use this whenever the user ' +
    'asks about their email, messages, or anything that might be in their inbox. ' +
    "The 'query' uses Gmail search syntax, e.g. 'from:amazon', 'subject:invoice', " +
    "'newer_than:7d', or plain keywords.",
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Gmail search query (operators like from:, subject:, newer_than:, or keywords).',
      },
      max_results: {
        type: 'number',
        description: `Maximum number of emails to return (default ${MAX_RESULTS}).`,
      },
    },
    required: ['query'],
  },

  async run(args): Promise<string> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return 'No search query was provided.';
    }
    const limit =
      typeof args.max_results === 'number' && args.max_results > 0
        ? Math.min(args.max_results, 10)
        : MAX_RESULTS;

    const creds = await getGmailCredentials();
    if (!creds) {
      return 'Gmail is not connected. Ask the user to tap the Gmail button in the app header and sign in with their email and a Google App Password.';
    }

    const emails = await searchGmail(
      creds.email,
      creds.appPassword,
      query,
      limit,
    );
    if (emails.length === 0) {
      return `No emails found matching "${query}".`;
    }

    const lines = emails.map((e, i) => {
      const parts = [
        `${i + 1}. From: ${e.from}`,
        `   Subject: ${e.subject}`,
        e.date ? `   Date: ${e.date}` : '',
        e.snippet ? `   Preview: ${e.snippet}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    });

    return `Found ${emails.length} email(s) matching "${query}":\n${lines.join('\n')}`;
  },
};
