import { getActiveAccounts } from './accountsStore';
import { searchAllAccounts } from './searchEmail';
import type { Skill } from '../types';

const PER_ACCOUNT = 5;

export const emailSkill: Skill = {
  name: 'search_email',
  description:
    "Search the user's connected email accounts (Gmail, Outlook, and other " +
    'IMAP mailboxes) and return matching messages with sender, subject, date ' +
    'and a short preview. Use this whenever the user asks about their email, ' +
    'inbox, or messages. The query may use simple operators like from:, ' +
    'subject:, to:, or plain keywords. Searches all connected accounts at once.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query — operators (from:, subject:, to:) or keywords.',
      },
      max_results: {
        type: 'number',
        description: `Max emails to return per account (default ${PER_ACCOUNT}).`,
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
        : PER_ACCOUNT;

    const accounts = await getActiveAccounts();
    if (accounts.length === 0) {
      return 'No email accounts are connected. Ask the user to tap the Accounts button in the app header to add one.';
    }

    const results = await searchAllAccounts(query, limit);
    const sections: string[] = [];
    let totalFound = 0;

    for (const { account, emails, error } of results) {
      if (error) {
        sections.push(`[${account.label} <${account.emailAddress}>] error: ${error}`);
        continue;
      }
      if (emails.length === 0) {
        sections.push(`[${account.label} <${account.emailAddress}>] no matches.`);
        continue;
      }
      totalFound += emails.length;
      const lines = emails.map((e, i) =>
        [
          `  ${i + 1}. From: ${e.from}`,
          `     Subject: ${e.subject}`,
          e.date ? `     Date: ${e.date}` : '',
          e.snippet ? `     Preview: ${e.snippet}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      sections.push(
        `[${account.label} <${account.emailAddress}>] ${emails.length} match(es):\n${lines.join('\n')}`,
      );
    }

    return (
      `Searched ${accounts.length} account(s) for "${query}" — ` +
      `${totalFound} total match(es):\n\n${sections.join('\n\n')}`
    );
  },
};
