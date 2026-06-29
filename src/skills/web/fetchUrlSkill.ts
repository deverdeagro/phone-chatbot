import { htmlToText } from './htmlToText';
import type { Skill } from '../types';

/** Cap on how much page text we feed back to the model (keeps us in context). */
const MAX_CHARS = 12000;
const TIMEOUT_MS = 20000;

export const fetchUrlSkill: Skill = {
  name: 'fetch_url',
  description:
    'Fetch the live contents of a web page (URL) and return its readable text. ' +
    'Use this whenever the user shares a link or asks you to read, open, or ' +
    'summarize a web page. Always call this before summarizing a URL — do not ' +
    'guess a page’s contents from its address.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL of the page to fetch (http or https).',
      },
    },
    required: ['url'],
  },

  async run(args): Promise<string> {
    const url = normalizeUrl(typeof args.url === 'string' ? args.url : '');
    if (!url) {
      return 'No valid URL was provided.';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android) PhoneChatbot/1.0 (+on-device assistant)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });
    } catch (e) {
      const reason = e instanceof Error && e.name === 'AbortError' ? 'timed out' : 'failed';
      return `Fetching ${url} ${reason}. The page may be unavailable or blocking automated requests.`;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return `Could not fetch ${url} (HTTP ${response.status}).`;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const raw = await response.text();

    let content: string;
    if (contentType.includes('html') || /<html[\s>]/i.test(raw)) {
      const { title, text } = htmlToText(raw);
      content = (title ? `Title: ${title}\n\n` : '') + text;
    } else {
      content = raw;
    }

    content = content.trim();
    if (!content) {
      return `Fetched ${url} but found no readable text (it may be a script-heavy or media page).`;
    }

    const truncated = content.length > MAX_CHARS;
    return (
      `Fetched page: ${url}\n\n` +
      content.slice(0, MAX_CHARS) +
      (truncated ? '\n\n[Content truncated — this is the beginning of the page.]' : '')
    );
  },
};

/** Add a scheme if missing and reject anything that isn't a plausible URL. */
function normalizeUrl(input: string): string | null {
  let url = input.trim();
  if (!url) {
    return null;
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Basic sanity: must have a dotted host.
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url)) {
    return null;
  }
  return url;
}
