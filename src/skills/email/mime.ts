/**
 * Decode RFC 2047 "encoded-words" found in email headers, e.g.
 *   =?UTF-8?B?SGVsbG8=?=  or  =?UTF-8?Q?Hi=20there?=
 * Falls back to the original text for anything it can't decode.
 */
export function decodeMimeWords(input: string): string {
  if (!input || !input.includes('=?')) {
    return input;
  }
  return input.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_m, _charset: string, enc: string, text: string) => {
      try {
        if (enc.toUpperCase() === 'B') {
          return utf8FromBinary(base64Decode(text));
        }
        const bytes = text
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (__, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        return utf8FromBinary(bytes);
      } catch {
        return text;
      }
    },
  );
}

function base64Decode(b64: string): string {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  return atobFn ? atobFn(b64) : b64;
}

function utf8FromBinary(binary: string): string {
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}
