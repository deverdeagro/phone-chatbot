export type EmailAuthType = 'imap' | 'graph';

/**
 * A connected email account. Mirrors the shape of a typical server-side
 * EmailAccount record, but stored on-device (secrets in the Keychain).
 */
export type EmailAccount = {
  id: string;
  label: string;
  emailAddress: string;
  authType: EmailAuthType;

  // IMAP fields (empty for Graph accounts).
  imapHost: string;
  imapPort: number;
  imapUseSsl: boolean;
  username: string;
  /** App password for IMAP accounts; empty for Graph. */
  password: string;

  // Microsoft Graph fields (empty for IMAP accounts).
  /** OAuth refresh token; we mint a fresh access token per search. */
  graphRefreshToken?: string;

  isActive: boolean;
  createdAt: number;
};

/** A single email returned from any account, normalized for the model. */
export type EmailSummary = {
  accountLabel: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

/** Result of searching one account. */
export type AccountSearchResult = {
  account: EmailAccount;
  emails: EmailSummary[];
  error?: string;
};
