import { updateAccount } from '../accountsStore';
import { getGraphAccessToken } from './graphAuth';
import type { EmailAccount, EmailSummary } from '../types';

type GraphMessage = {
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
};

/**
 * Search an Outlook/Office 365 account via Microsoft Graph. Mints a fresh
 * access token from the stored refresh token, then runs a $search query.
 */
export async function searchGraphAccount(
  account: EmailAccount,
  query: string,
  limit: number,
): Promise<EmailSummary[]> {
  if (!account.graphRefreshToken) {
    throw new Error('Microsoft account is not signed in.');
  }

  const { accessToken, refreshToken } = await getGraphAccessToken(
    account.graphRefreshToken,
  );
  // Persist a rotated refresh token so the next search still works.
  if (refreshToken !== account.graphRefreshToken) {
    await updateAccount(account.id, { graphRefreshToken: refreshToken });
  }

  const url =
    'https://graph.microsoft.com/v1.0/me/messages' +
    `?$search=${encodeURIComponent(`"${query}"`)}` +
    `&$top=${limit}` +
    '&$select=subject,from,receivedDateTime,bodyPreview';

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: 'eventual',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph search failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { value?: GraphMessage[] };
  return (data.value ?? []).map(m => {
    const addr = m.from?.emailAddress;
    const from = addr
      ? `${addr.name ?? ''}${addr.address ? ` <${addr.address}>` : ''}`.trim()
      : '(unknown sender)';
    return {
      accountLabel: account.label,
      from,
      subject: m.subject || '(no subject)',
      date: m.receivedDateTime ?? '',
      snippet: (m.bodyPreview ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
    };
  });
}
