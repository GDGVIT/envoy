import "server-only";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { randomBytes } from "crypto";
import User from "@/models/user";
import ApiToken from "@/models/apiToken";
import { rateLimit, unauthorized } from "@/lib/http";
import { sha256 } from "@/lib/totp";
import { isMfaEnrolled } from "@/lib/passkeys";

export type AuthedUser = {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    via: "session" | "token";
    /** Has a passkey or authenticator app. */
    mfaEnrolled: boolean;
    /**
     * Passed two-factor: a session that completed the second step, or a token whose owner has 2FA set up.
     * Organizations that require 2FA only admit callers with this set.
     */
    mfa: boolean;
};

export const PAT_PREFIX = "envoy_pat_";

export function generatePat() {
    const token = `${PAT_PREFIX}${randomBytes(24).toString("base64url")}`;
    return { token, hash: sha256(token), prefix: token.slice(0, PAT_PREFIX.length + 4) };
}

async function fromBearer(req: NextRequest): Promise<AuthedUser | null> {
    const header = req.headers.get("authorization") || "";
    const [scheme, value] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !value?.startsWith(PAT_PREFIX)) return null;

    const apiToken = await ApiToken.findOne({ tokenHash: sha256(value), revokedAt: null });
    if (!apiToken) throw unauthorized("Invalid or revoked API token.", "invalid_token");
    if (apiToken.expiresAt && apiToken.expiresAt.getTime() < Date.now()) {
        throw unauthorized("API token has expired.", "token_expired");
    }

    const user = await User.findById(apiToken.user).select("name email emailVerified totpEnabled passkeyCount");
    if (!user) throw unauthorized("Invalid API token.", "invalid_token");

    // Avoid a write on every request: update lastUsedAt at most once a minute.
    if (!apiToken.lastUsedAt || Date.now() - apiToken.lastUsedAt.getTime() > 60_000) {
        ApiToken.updateOne({ _id: apiToken._id }, { lastUsedAt: new Date() }).catch(() => {});
    }

    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        emailVerified: !!user.emailVerified,
        via: "token",
        mfaEnrolled: isMfaEnrolled(user),
        mfa: isMfaEnrolled(user),
    };
}

/**
 * Resolves the caller from the NextAuth session (must match the current sessionVersion, and must have
 * completed the second step if the account has 2FA set up) or, when `allowToken` is set, from a
 * personal access token. Two-factor itself is optional per account; organizations can require it.
 */
export async function requireUser(req: NextRequest, opts: { allowToken?: boolean } = {}): Promise<AuthedUser> {
    await rateLimit(req);

    if (opts.allowToken) {
        const tokenUser = await fromBearer(req);
        if (tokenUser) return tokenUser;
    }

    const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!jwt?.id) throw unauthorized();

    const user = await User.findById(jwt.id).select("name email emailVerified sessionVersion totpEnabled passkeyCount");
    if (!user || (user.sessionVersion ?? 0) !== (jwt.sv ?? 0)) {
        throw unauthorized("Your session has expired. Please sign in again.", "session_revoked");
    }
    // Anyone with 2FA set up always uses it, whatever their organizations require.
    const enrolled = isMfaEnrolled(user);
    if (enrolled && !jwt.mfaVerified) throw unauthorized("Two-factor authentication required.", "mfa_required");

    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        emailVerified: !!user.emailVerified,
        via: "session",
        mfaEnrolled: enrolled,
        mfa: enrolled && !!jwt.mfaVerified,
    };
}

/** For 2FA endpoints: a signed-in user who may not have completed MFA yet. */
export async function requirePartialUser(req: NextRequest) {
    await rateLimit(req);
    const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!jwt?.id) throw unauthorized();
    const user = await User.findById(jwt.id);
    if (!user || (user.sessionVersion ?? 0) !== (jwt.sv ?? 0)) {
        throw unauthorized("Your session has expired. Please sign in again.", "session_revoked");
    }
    return { user, jwt };
}
