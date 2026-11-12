import "server-only";
import User from "@/models/user";
import { forbidden } from "@/lib/http";
import type { AuthedUser } from "@/lib/auth";

/** How long one confirmed authenticator code unlocks secret values. */
export const REVEAL_TTL_MS = 10 * 60 * 1000;

/**
 * For a browser session of someone with 2FA set up, secret values are only sent after they confirm a fresh
 * code or passkey. The unlock lives on the user record in MongoDB (never in the browser) and expires
 * after REVEAL_TTL_MS. People without 2FA (allowed when their orgs don't require it) see values directly.
 * Personal API tokens are credentials in their own right and aren't subject to it.
 */
export const revealRequired = (me: AuthedUser) => me.via === "session" && me.mfaEnrolled;

export async function revealUntil(me: AuthedUser): Promise<Date | null> {
    if (me.via === "token") return null;
    const user = await User.findById(me.id).select("+revealUntil").lean<{ revealUntil?: Date }>();
    const until = user?.revealUntil;
    return until && until.getTime() > Date.now() ? until : null;
}

export async function canSeeValues(me: AuthedUser) {
    return !revealRequired(me) || !!(await revealUntil(me));
}

export async function assertCanSeeValues(me: AuthedUser) {
    if (!(await canSeeValues(me))) {
        throw forbidden("Confirm your authenticator code to see secret values.", "reveal_required");
    }
}



