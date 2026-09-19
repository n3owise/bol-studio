/**
 * A file size in the units a person would say out loud.
 *
 * Binary steps with decimal names (1 KB is 1024 bytes) because that is what the
 * file managers on the platforms this runs on report, so a figure here matches
 * the one shown beside the same file on disk.
 *
 * One decimal place from MB upward and none below it: "1.4 GB" is worth
 * knowing, "1.42 GB" is noise, and "512.0 KB" claims a precision that the
 * number does not have while a save is in flight.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit >= 2 ? 1 : 0)} ${units[unit]}`;
}

/**
 * A clip length as a ceiling is announced in, rather than as a timecode.
 *
 * "20 minutes" is a limit; "20:00.0" is a playhead position. The editor's
 * `timecode` is for the latter and reads wrongly here.
 *
 * The minutes are floored, never rounded. A 90-second cap rounded to "2
 * minutes" tells someone holding a 100-second clip that they are inside a limit
 * that will refuse them — a number that is wrong in the direction of raising
 * expectations it cannot meet. Under a minute, and for any remainder, it says
 * the seconds instead of claiming a precision it does not have.
 */
export function formatMinutes(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 seconds';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (rest === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return `${minutes}m ${rest}s`;
}

export type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: string]: any }
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  function process(input: ClassValue) {
    if (!input) return;
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      for (const item of input) {
        process(item);
      }
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  for (const input of inputs) {
    process(input);
  }

  return classes.join(' ');
}

/**
 * Put text on the clipboard, or report honestly that it could not.
 *
 * navigator.clipboard.writeText rejects — it throws, rather than returning
 * false — whenever the document is not focused, which covers more real moments
 * than it sounds like: a click arriving while devtools has focus, an automated
 * browser, an embedded view. The button that called this looked like a working
 * button and did nothing on those, which is the exact failure this codebase
 * keeps finding.
 *
 * So there is a fallback, and the caller is told which way it went rather than
 * being left to assume. Whatever this returns, the value it was asked to copy
 * is also on screen and selectable, so a person is never left with no way to
 * get at it.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Deliberately quiet: the fallback below is the answer, not an error.
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.style.top = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}
