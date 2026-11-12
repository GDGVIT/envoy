/**
 * Temporary share links: the only way to show variables without signing in.
 * They always expire, never later than MAX_SHARE_TTL_SECONDS after creation.
 */
export const SHARE_TTL_OPTIONS = [
    { seconds: 10 * 60, label: "10 minutes" },
    { seconds: 60 * 60, label: "1 hour" },
    { seconds: 24 * 60 * 60, label: "24 hours" },
] as const;

export const MAX_SHARE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Share tokens end with their expiry time (`<random>.<ms in base36>`), so an expired link can still be
 * recognised as expired after its data has been deleted. The suffix only says when the link stops
 * working; it isn't secret and grants nothing.
 */
export function withExpiry(random: string, expiresAt: Date) {
    return `${random}.${expiresAt.getTime().toString(36)}`;
}

/** The expiry encoded in a share token, or null for tokens without one (older links) or malformed ones. */
export function tokenExpiry(token: string): Date | null {
    const suffix = token.split(".")[1];
    if (!suffix || !/^[0-9a-z]{6,12}$/.test(suffix)) return null;
    const ms = parseInt(suffix, 36);
    return Number.isFinite(ms) ? new Date(ms) : null;
}
