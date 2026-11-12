import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { requirePartialUser } from "@/lib/auth";
import { HttpError, badRequest, forbidden, json, parseBody, route } from "@/lib/http";
import { relyingParty, takeChallenge, transportsOf } from "@/lib/passkeys";
import { REVEAL_TTL_MS } from "@/lib/reveal";
import { generateBackupCodes, generateMfaTicket } from "@/lib/totp";
import { mfaLimiter } from "@/utils/limiter";
import Passkey from "@/models/passkey";
import User from "@/models/user";

const schema = z.object({
    response: z.looseObject({ id: z.string().min(1).max(1024), type: z.literal("public-key") }),
    /**
     * What the passkey confirms: the second step of signing in, unlocking secret values for 10 minutes,
     * or generating new backup codes. The last two need a session that already passed 2FA.
     */
    purpose: z.enum(["login", "reveal", "backup-codes"]),
});

export const POST = route(async (req: NextRequest) => {
    const { user, jwt } = await requirePartialUser(req);
    const { response, purpose } = await parseBody(req, schema);
    if (purpose !== "login" && !jwt?.mfaVerified) throw forbidden("Finish signing in first.", "mfa_required");

    const limiterKey = `passkey:${user._id}`;
    try {
        await mfaLimiter.consume(limiterKey);
    } catch {
        throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
    }

    const expectedChallenge = await takeChallenge(user._id);
    if (!expectedChallenge) throw badRequest("That took too long. Try again.", "challenge_expired");

    const key: any = await Passkey.findOne({ user: user._id, credentialId: response.id });
    if (!key) throw badRequest("That passkey isn't registered to this account.", "unknown_passkey");

    const { rpID, origin } = relyingParty(req);
    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: response as any,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: { id: key.credentialId, publicKey: isoBase64URL.toBuffer(key.publicKey), counter: key.counter, transports: transportsOf(key) },
            requireUserVerification: false,
        });
    } catch (e: any) {
        throw badRequest(`Couldn't verify the passkey: ${e?.message ?? "unknown error"}`, "passkey_invalid");
    }
    if (!verification.verified) throw badRequest("Couldn't verify the passkey.", "passkey_invalid");

    await mfaLimiter.delete(limiterKey);
    await Passkey.updateOne({ _id: key._id }, { $set: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } });

    if (purpose === "reveal") {
        const revealUntil = new Date(Date.now() + REVEAL_TTL_MS);
        await User.updateOne({ _id: user._id }, { $set: { revealUntil } });
        return json({ revealUntil });
    }
    if (purpose === "backup-codes") {
        const { codes, hashes } = generateBackupCodes();
        await User.updateOne({ _id: user._id }, { $set: { backupCodes: hashes } });
        return json({ backupCodes: codes });
    }
    const ticket = generateMfaTicket();
    await User.updateOne({ _id: user._id }, { $set: { mfaTicketHash: ticket.hash, mfaTicketExpiry: ticket.expiry } });
    return json({ mfaTicket: ticket.ticket });
});
