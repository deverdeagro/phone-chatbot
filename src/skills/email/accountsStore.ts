import * as Keychain from 'react-native-keychain';
import type { EmailAccount } from './types';

const SERVICE = 'email-accounts';
const LEGACY_GMAIL_SERVICE = 'gmail-imap';

let migrated = false;

/** Load all connected accounts (migrating any legacy single-Gmail setup once). */
export async function getAccounts(): Promise<EmailAccount[]> {
  await migrateLegacyGmail();
  return readAccounts();
}

export async function getActiveAccounts(): Promise<EmailAccount[]> {
  return (await getAccounts()).filter(a => a.isActive);
}

export async function addAccount(account: EmailAccount): Promise<void> {
  const all = await readAccounts();
  await persist([...all.filter(a => a.id !== account.id), account]);
}

export async function updateAccount(
  id: string,
  patch: Partial<EmailAccount>,
): Promise<void> {
  const all = await readAccounts();
  await persist(all.map(a => (a.id === id ? { ...a, ...patch } : a)));
}

export async function removeAccount(id: string): Promise<void> {
  const all = await readAccounts();
  await persist(all.filter(a => a.id !== id));
}

export function newAccountId(): string {
  return `acct_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function readAccounts(): Promise<EmailAccount[]> {
  const stored = await Keychain.getGenericPassword({ service: SERVICE });
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored.password);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persist(accounts: EmailAccount[]): Promise<void> {
  await Keychain.setGenericPassword('accounts', JSON.stringify(accounts), {
    service: SERVICE,
  });
}

/** Import a previously-connected single Gmail account into the new store. */
async function migrateLegacyGmail(): Promise<void> {
  if (migrated) {
    return;
  }
  migrated = true;
  try {
    const legacy = await Keychain.getGenericPassword({
      service: LEGACY_GMAIL_SERVICE,
    });
    if (!legacy) {
      return;
    }
    const existing = await readAccounts();
    if (existing.some(a => a.emailAddress === legacy.username)) {
      return;
    }
    const account: EmailAccount = {
      id: newAccountId(),
      label: 'Gmail',
      emailAddress: legacy.username,
      authType: 'imap',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapUseSsl: true,
      username: legacy.username,
      password: legacy.password,
      isActive: true,
      createdAt: Date.now(),
    };
    await persist([...existing, account]);
  } catch {
    // best-effort migration; ignore failures
  }
}
