/**
 * Decode RFC 2047 "encoded-words" that appear in email headers, e.g.
 *   =?UTF-8?B?SGVsbG8=?=  or  =?UTF-8?Q?Hi=20there?=
 * Falls back to returning the input unchanged for anything it can't decode.
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
        // Q-encoding: '_' is space, '=XX' is a hex byte.
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
  // Hermes provides global.atob in modern React Native.
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (atobFn) {
    return atobFn(b64);
  }
  return b64;
}

/** Interpret a binary (latin1) string as UTF-8 text. */
function utf8FromBinary(binary: string): string {
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}
