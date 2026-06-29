import { getActiveAccounts } from './accountsStore';
import { searchImapAccount } from './imapClient';
import { searchGraphAccount } from './graph/graphClient';
import type { AccountSearchResult } from './types';

/**
 * Search every active account in parallel and return per-account results.
 * A failure in one account doesn't fail the others.
 */
export async function searchAllAccounts(
  query: string,
  perAccountLimit: number,
): Promise<AccountSearchResult[]> {
  const accounts = await getActiveAccounts();
  return Promise.all(
    accounts.map(async account => {
      try {
        const emails =
          account.authType === 'graph'
            ? await searchGraphAccount(account, query, perAccountLimit)
            : await searchImapAccount(account, query, perAccountLimit);
        return { account, emails };
      } catch (e) {
        return {
          account,
          emails: [],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );
}
