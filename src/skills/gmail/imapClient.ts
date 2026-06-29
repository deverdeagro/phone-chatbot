import TcpSocket from 'react-native-tcp-socket';
import { decodeMimeWords } from './mime';

const HOST = 'imap.gmail.com';
const PORT = 993;
const TIMEOUT_MS = 25000;

export type EmailSummary = {
  uid: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

type TLSSocket = ReturnType<typeof TcpSocket.connectTLS>;

/**
 * Minimal IMAP-over-TLS client, just enough to log in to Gmail with an App
 * Password and search/preview the inbox. One command runs at a time; each
 * command resolves when its tagged completion (`aN OK/NO/BAD`) arrives.
 */
class ImapConnection {
  private socket: TLSSocket | null = null;
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
        () => reject(new Error('Timed out connecting to Gmail (IMAP).')),
        TIMEOUT_MS,
      );

      const socket = TcpSocket.connectTLS({ host: HOST, port: PORT }, () => {});
      this.socket = socket;
      socket.setEncoding('utf8');

      // We call setEncoding('utf8'), so data arrives as strings (the socket
      // type still allows a binary chunk, so coerce defensively).
      socket.on('data', (chunk: string | { toString(): string }) => {
        this.buffer += typeof chunk === 'string' ? chunk : chunk.toString();
        this.processBuffer(timer);
      });
      socket.on('error', (err: Error) => {
        clearTimeout(timer);
        this.failAll(err);
      });
      socket.on('close', () => {
        this.failAll(new Error('Gmail connection closed unexpectedly.'));
      });
    });
  }

  private processBuffer(connectTimer?: ReturnType<typeof setTimeout>) {
    // Resolve the initial server greeting once.
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
        () => reject(new Error('Gmail (IMAP) command timed out.')),
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

  async login(email: string, appPassword: string): Promise<void> {
    await this.send(`LOGIN ${quote(email)} ${quote(appPassword)}`);
  }

  async selectInbox(): Promise<void> {
    await this.send('SELECT INBOX');
  }

  /** Search using Gmail's native search syntax (from:, subject:, keywords…). */
  async search(query: string): Promise<string[]> {
    const res = await this.send(`UID SEARCH X-GM-RAW ${quote(query)}`);
    const line = res.match(/\* SEARCH([^\r\n]*)/i);
    if (!line) {
      return [];
    }
    return line[1].trim().split(/\s+/).filter(Boolean);
  }

  /** Fetch sender/subject/date headers plus a short body snippet for one UID. */
  async fetchSummary(uid: string): Promise<EmailSummary> {
    const res = await this.send(
      `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[1]<0.400>)`,
    );

    const headerBlock = extractLiteral(res, 'HEADER.FIELDS') ?? '';
    const unfolded = headerBlock.replace(/\r\n[ \t]+/g, ' ');
    const header = (name: string) =>
      unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'))?.[1]?.trim() ?? '';

    const bodyRaw = extractLiteral(res, 'BODY[1]') ?? '';
    const snippet = bodyRaw.replace(/\s+/g, ' ').trim().slice(0, 240);

    return {
      uid,
      from: decodeMimeWords(header('From')),
      subject: decodeMimeWords(header('Subject')) || '(no subject)',
      date: header('Date'),
      snippet,
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

/** Quote a string as an IMAP quoted-string, escaping `\` and `"`. */
function quote(s: string): string {
  return `"${s.replace(/([\\"])/g, '\\$1')}"`;
}

/**
 * Extract the IMAP literal (`{N}\r\n...`) that immediately follows `marker`
 * in the response text. Returns null if not found.
 */
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
  const len = parseInt(lit[1], 10);
  return response.slice(start, start + len);
}

/**
 * Connect, search Gmail, and return summaries for the most recent matches.
 */
export async function searchGmail(
  email: string,
  appPassword: string,
  query: string,
  limit: number,
): Promise<EmailSummary[]> {
  const conn = new ImapConnection();
  try {
    await conn.connect();
    await conn.login(email, appPassword);
    await conn.selectInbox();
    const uids = await conn.search(query);
    // UIDs come back ascending; take the most recent `limit`, newest first.
    const recent = uids.slice(-limit).reverse();
    const summaries: EmailSummary[] = [];
    for (const uid of recent) {
      summaries.push(await conn.fetchSummary(uid));
    }
    return summaries;
  } finally {
    conn.close();
  }
}
