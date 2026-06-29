import * as Keychain from 'react-native-keychain';

const SERVICE = 'gmail-imap';

export type GmailCredentials = {
  email: string;
  /** 16-character Google App Password (not the account password). */
  appPassword: string;
};

/** Persist the Gmail email + App Password in the device keychain. */
export async function saveGmailCredentials(
  creds: GmailCredentials,
): Promise<void> {
  await Keychain.setGenericPassword(creds.email, creds.appPassword, {
    service: SERVICE,
  });
}

/** Load stored Gmail credentials, or null if none are saved. */
export async function getGmailCredentials(): Promise<GmailCredentials | null> {
  const stored = await Keychain.getGenericPassword({ service: SERVICE });
  if (!stored) {
    return null;
  }
  return { email: stored.username, appPassword: stored.password };
}

/** Forget stored Gmail credentials (disconnect). */
export async function clearGmailCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
