/**
 * Invite codes: 10 characters from an alphabet without look-alikes (no 0/O, 1/I/L), shown as XXXXX-XXXXX.
 * The code is the invite's secret: /invite/<code> links use it too. 31^10 ≈ 8 × 10^14 possible codes,
 * and every invite expires within 30 days, so guessing one isn't practical.
 * Safe to import on the client (no Node APIs here).
 */

export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 10;

const CODE_RE = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** Characters a user may type into the code field (validated against the alphabet on submit). */
export const INVITE_CODE_INPUT_PATTERN = "^[A-Za-z0-9]+$";

/**
 * Turns whatever the user entered (a code with or without dashes or spaces, in any case, or a full
 * /invite/<code> link) into the stored form. Older long link tokens pass through unchanged.
 */
export function normalizeInviteToken(input: string): string {
    const trimmed = input.trim();
    const fromLink = trimmed.match(/\/invite\/([A-Za-z0-9_-]+)/)?.[1] ?? trimmed;
    const compact = fromLink.replace(/[\s-]/g, "");
    return compact.length === INVITE_CODE_LENGTH ? compact.toUpperCase() : fromLink;
}

export function isInviteCode(value: string) {
    return CODE_RE.test(value);
}

/** "K7Q2M9XA4P" → "K7Q2M-9XA4P" */
export function formatInviteCode(code: string) {
    return code.length === INVITE_CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}
