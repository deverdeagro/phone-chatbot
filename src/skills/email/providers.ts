export type ImapPreset = { host: string; port: number; ssl: boolean };

/** Known IMAP servers keyed by email domain, so we can auto-fill the form. */
const PRESETS: Record<string, ImapPreset> = {
  'gmail.com': { host: 'imap.gmail.com', port: 993, ssl: true },
  'googlemail.com': { host: 'imap.gmail.com', port: 993, ssl: true },
  'yahoo.com': { host: 'imap.mail.yahoo.com', port: 993, ssl: true },
  'icloud.com': { host: 'imap.mail.me.com', port: 993, ssl: true },
  'me.com': { host: 'imap.mail.me.com', port: 993, ssl: true },
  'mac.com': { host: 'imap.mail.me.com', port: 993, ssl: true },
  'aol.com': { host: 'imap.aol.com', port: 993, ssl: true },
  'fastmail.com': { host: 'imap.fastmail.com', port: 993, ssl: true },
  'zoho.com': { host: 'imap.zoho.com', port: 993, ssl: true },
  // Outlook/O365 are listed for reference but require Microsoft Graph (OAuth);
  // basic-auth IMAP is disabled by Microsoft.
  'outlook.com': { host: 'outlook.office365.com', port: 993, ssl: true },
  'hotmail.com': { host: 'outlook.office365.com', port: 993, ssl: true },
  'live.com': { host: 'outlook.office365.com', port: 993, ssl: true },
};

export function presetForEmail(email: string): ImapPreset | null {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? PRESETS[domain] ?? null : null;
}

/** Microsoft domains that should use Graph (OAuth) rather than IMAP. */
export function isMicrosoftDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain);
}

/** Gmail IMAP servers support the richer X-GM-RAW search extension. */
export function isGmailHost(host: string): boolean {
  return /imap\.(gmail|googlemail)\.com/i.test(host);
}
