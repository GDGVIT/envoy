import "server-only";
import { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";
import { trusted } from "mongoose";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import User from "@/models/user";
import Passkey from "@/models/passkey";
import { badRequest, forbidden } from "@/lib/http";
import Organization from "@/models/organization";
import OrgMembership from "@/models/orgMembership";

/** How long a WebAuthn challenge stays valid (the browser prompt is open). */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** A user has two-factor set up when they have an authenticator app or at least one passkey. */
export function isMfaEnrolled(user: { totpEnabled?: boolean; passkeyCount?: number } | null | undefined) {
    return !!user && (!!user.totpEnabled || (user.passkeyCount ?? 0) > 0);
}

/**
 * Adding a second factor needs either a session that already passed 2FA, or an account with none yet
 * (first-time setup). Otherwise a stolen password alone could add the attacker's own authenticator.
 */
export function assertCanEnroll(user: { totpEnabled?: boolean; passkeyCount?: number }, jwt: JWT | null) {
    if (isMfaEnrolled(user) && !jwt?.mfaVerified) {
        throw forbidden("Finish signing in with your existing two-factor method first.", "mfa_required");
    }
}

/**
 * Relying party for WebAuthn: passkeys are bound to this domain. WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN can
 * pin them (e.g. to share passkeys across subdomains); otherwise the domain the request came to is used.
 */
export function relyingParty(req: NextRequest) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const origin = process.env.WEBAUTHN_ORIGIN ?? `${proto}://${host}`;
    const rpID = process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname;
    return { rpID, origin, rpName: "Envoy" };
}

/** One in-flight challenge per user, kept server-side and usable once. */
export async function saveChallenge(userId: unknown, challenge: string) {
    await User.updateOne(
        { _id: userId },
        { $set: { webauthnChallenge: challenge, webauthnChallengeExpiry: new Date(Date.now() + CHALLENGE_TTL_MS) } }
    );
}

export async function takeChallenge(userId: unknown): Promise<string | null> {
    const user = await User.findOneAndUpdate(
        { _id: userId },
        { $unset: { webauthnChallenge: 1, webauthnChallengeExpiry: 1 } }
    ).select("+webauthnChallenge +webauthnChallengeExpiry");
    if (!user?.webauthnChallenge || !user.webauthnChallengeExpiry || user.webauthnChallengeExpiry.getTime() < Date.now()) return null;
    return user.webauthnChallenge;
}

export async function passkeysFor(userId: unknown) {
    return Passkey.find({ user: userId }).sort({ createdAt: 1 });
}

export const transportsOf = (p: { transports?: string[] }) => (p.transports ?? []) as AuthenticatorTransportFuture[];

/** Keeps User.passkeyCount in step with the Passkey collection (read on every request for "enrolled"). */
export async function syncPasskeyCount(userId: unknown) {
    const count = await Passkey.countDocuments({ user: userId });
    await User.updateOne({ _id: userId }, { $set: { passkeyCount: count } });
    return count;
}

/** A readable default name from the browser's user agent, e.g. "Chrome on macOS". */
export function defaultPasskeyName(req: NextRequest) {
    const ua = req.headers.get("user-agent") ?? "";
    const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
    return os ? `${browser} on ${os}` : browser;
}

/**
 * Removing someone's last second factor is fine unless one of their organizations requires 2FA.
 * Call before removing a passkey or the authenticator app; `remaining` is how many would be left.
 */
export async function assertCanRemoveFactor(userId: unknown, remaining: number) {
    if (remaining > 0) return;
    const orgIds = (await OrgMembership.find({ user: userId }).select("org")).map((m: any) => m.org);
    // Orgs from before the setting existed have no value stored and count as requiring 2FA.
    const strict = await Organization.findOne({ _id: trusted({ $in: orgIds }), require2fa: trusted({ $ne: false }) }).select("name");
    if (strict) {
        throw badRequest(`${strict.name} requires two-factor authentication. Add another passkey or an authenticator app first.`, "last_factor");
    }
}

/** After the last factor is gone: backup codes and any value unlock go with it. */
export async function clearIfNoFactorsLeft(userId: unknown) {
    const user = await User.findById(userId).select("totpEnabled passkeyCount");
    if (user && !isMfaEnrolled(user)) {
        await User.updateOne({ _id: userId }, { $set: { backupCodes: [] }, $unset: { revealUntil: 1 } });
    }
}
