import TcpSocket from 'react-native-tcp-socket';
import { decodeMimeWords } from './mime';
import { isGmailHost } from './providers';
import type { EmailAccount, EmailSummary } from './types';

const TIMEOUT_MS = 25000;

type Socket = ReturnType<typeof TcpSocket.createConnection>;

/**
 * Minimal IMAP-over-TLS (or plain TCP) client: log in, select INBOX, search,
 * and preview messages. One command runs at a time; each resolves when its
 * tagged completion (`aN OK/NO/BAD`) arrives.
 */
class ImapConnection {
  constructor(
    private host: string,
    private port: number,
    private ssl: boolean,
  ) {}

  private socket: Socket | null = null;
  private buffer = '';
  private tagSeq = 0;
  private pending: {
    tag: string;
    resolve: (text: string) => void;
    reject: (err: Error) => void;
  } | null = null;
  private greeting: { resolve: () => void; reject: (e: Error) => void } | null =
    null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.greeting = { resolve, reject };
      const timer = setTimeout(
        () => reject(new Error(`Timed out connecting to ${this.host}.`)),
        TIMEOUT_MS,
      );

      const opts = { host: this.host, port: this.port };
      const socket = this.ssl
        ? TcpSocket.connectTLS(opts, () => {})
        : TcpSocket.createConnection(opts, () => {});
      this.socket = socket;
      socket.setEncoding('utf8');

      socket.on('data', (chunk: string | { toString(): string }) => {
        this.buffer += typeof chunk === 'string' ? chunk : chunk.toString();
        this.processBuffer(timer);
      });
      socket.on('error', (err: Error) => {
        clearTimeout(timer);
        this.failAll(err);
      });
      socket.on('close', () => {
        this.failAll(new Error('Connection closed unexpectedly.'));
      });
    });
  }

  private processBuffer(connectTimer?: ReturnType<typeof setTimeout>) {
    if (this.greeting) {
      if (/^\* (OK|PREAUTH)/m.test(this.buffer)) {
        const g = this.greeting;
        this.greeting = null;
        this.buffer = '';
        if (connectTimer) {
          clearTimeout(connectTimer);
        }
        g.resolve();
      }
      return;
    }
    if (!this.pending) {
      return;
    }
    const { tag } = this.pending;
    const re = new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)([^\\r\\n]*)\\r\\n`);
    const m = this.buffer.match(re);
    if (!m) {
      return;
    }
    const endIdx = (m.index ?? 0) + m[0].length;
    const responseText = this.buffer.slice(0, endIdx);
    this.buffer = this.buffer.slice(endIdx);
    const status = m[2];
    const { resolve, reject } = this.pending;
    this.pending = null;
    if (status === 'OK') {
      resolve(responseText);
    } else {
      reject(new Error(m[3]?.trim() || `IMAP command failed (${status}).`));
    }
  }

  private send(command: string): Promise<string> {
    if (!this.socket) {
      return Promise.reject(new Error('Not connected.'));
    }
    const tag = `a${++this.tagSeq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('IMAP command timed out.')),
        TIMEOUT_MS,
      );
      this.pending = {
        tag,
        resolve: t => {
          clearTimeout(timer);
          resolve(t);
        },
        reject: e => {
          clearTimeout(timer);
          reject(e);
        },
      };
      this.socket!.write(`${tag} ${command}\r\n`);
    });
  }

  private failAll(err: Error) {
    this.greeting?.reject(err);
    this.greeting = null;
    this.pending?.reject(err);
    this.pending = null;
  }

  async login(username: string, password: string): Promise<void> {
    await this.send(`LOGIN ${quote(username)} ${quote(password)}`);
  }

  async selectInbox(): Promise<void> {
    await this.send('SELECT INBOX');
  }

  /** Search the inbox; uses Gmail's X-GM-RAW when available, else standard IMAP. */
  async search(query: string, gmail: boolean): Promise<string[]> {
    const criteria = gmail
      ? `X-GM-RAW ${quote(query)}`
      : buildStandardSearch(query);
    const res = await this.send(`UID SEARCH ${criteria}`);
    const line = res.match(/\* SEARCH([^\r\n]*)/i);
    return line ? line[1].trim().split(/\s+/).filter(Boolean) : [];
  }

  async fetchSummary(uid: string, accountLabel: string): Promise<EmailSummary> {
    const res = await this.send(
      `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[1]<0.400>)`,
    );
    const headerBlock = extractLiteral(res, 'HEADER.FIELDS') ?? '';
    const unfolded = headerBlock.replace(/\r\n[ \t]+/g, ' ');
    const header = (name: string) =>
      unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'))?.[1]?.trim() ?? '';
    const bodyRaw = extractLiteral(res, 'BODY[1]') ?? '';
    return {
      accountLabel,
      from: decodeMimeWords(header('From')),
      subject: decodeMimeWords(header('Subject')) || '(no subject)',
      date: header('Date'),
      snippet: bodyRaw.replace(/\s+/g, ' ').trim().slice(0, 240),
    };
  }

  close() {
    try {
      this.socket?.write('aZ LOGOUT\r\n');
      this.socket?.destroy();
    } catch {
      // ignore
    }
    this.socket = null;
  }
}

function quote(s: string): string {
  return `"${s.replace(/([\\"])/g, '\\$1')}"`;
}

/**
 * Translate a free-text / Gmail-style query into standard IMAP SEARCH criteria
 * (ANDed). e.g. `from:bob invoice` -> `FROM "bob" TEXT "invoice"`.
 */
function buildStandardSearch(query: string): string {
  const parts: string[] = [];
  const remaining = query
    .replace(/\bfrom:(\S+)/gi, (_m, v: string) => {
      parts.push(`FROM ${quote(v)}`);
      return '';
    })
    .replace(/\bsubject:(\S+)/gi, (_m, v: string) => {
      parts.push(`SUBJECT ${quote(v)}`);
      return '';
    })
    .replace(/\bto:(\S+)/gi, (_m, v: string) => {
      parts.push(`TO ${quote(v)}`);
      return '';
    })
    .trim();
  if (remaining) {
    parts.push(`TEXT ${quote(remaining)}`);
  }
  return parts.length ? parts.join(' ') : 'ALL';
}

function extractLiteral(response: string, marker: string): string | null {
  const markerIdx = response.indexOf(marker);
  if (markerIdx === -1) {
    return null;
  }
  const lit = response.slice(markerIdx).match(/\{(\d+)\}\r\n/);
  if (!lit || lit.index === undefined) {
    return null;
  }
  const start = markerIdx + lit.index + lit[0].length;
  return response.slice(start, start + parseInt(lit[1], 10));
}

/** Connect to an IMAP account, search, and return the most recent matches. */
export async function searchImapAccount(
  account: EmailAccount,
  query: string,
  limit: number,
): Promise<EmailSummary[]> {
  const conn = new ImapConnection(
    account.imapHost,
    account.imapPort,
    account.imapUseSsl,
  );
  try {
    await conn.connect();
    await conn.login(account.username || account.emailAddress, account.password);
    await conn.selectInbox();
    const uids = await conn.search(query, isGmailHost(account.imapHost));
    const recent = uids.slice(-limit).reverse();
    const out: EmailSummary[] = [];
    for (const uid of recent) {
      out.push(await conn.fetchSummary(uid, account.label));
    }
    return out;
  } finally {
    conn.close();
  }
}

/** Quick credential check used when adding an account. */
export async function verifyImapAccount(account: EmailAccount): Promise<void> {
  const conn = new ImapConnection(
    account.imapHost,
    account.imapPort,
    account.imapUseSsl,
  );
  try {
    await conn.connect();
    await conn.login(account.username || account.emailAddress, account.password);
    await conn.selectInbox();
  } finally {
    conn.close();
  }
}
