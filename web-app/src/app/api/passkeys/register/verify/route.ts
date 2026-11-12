import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { requirePartialUser } from "@/lib/auth";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { assertCanEnroll, defaultPasskeyName, isMfaEnrolled, relyingParty, syncPasskeyCount, takeChallenge } from "@/lib/passkeys";
import { generateBackupCodes, generateMfaTicket } from "@/lib/totp";
import Passkey from "@/models/passkey";
import User from "@/models/user";

const schema = z.object({
    response: z.looseObject({ id: z.string().min(1).max(1024), type: z.literal("public-key") }),
    name: z.string().trim().max(64).optional(),
});

/**
 * Step 2 of adding a passkey: checks the browser's response and stores the public key. When this is the
 * account's first second factor (sign-up), it also returns backup codes and an MFA ticket for the session.
 */
export const POST = route(async (req: NextRequest) => {
    const { user, jwt } = await requirePartialUser(req);
    assertCanEnroll(user, jwt);
    const { response, name } = await parseBody(req, schema);

    const expectedChallenge = await takeChallenge(user._id);
    if (!expectedChallenge) throw badRequest("That took too long. Try adding the passkey again.", "challenge_expired");

    const { rpID, origin } = relyingParty(req);
    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: response as any,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: false,
        });
    } catch (e: any) {
        throw badRequest(`Couldn't verify the passkey: ${e?.message ?? "unknown error"}`, "passkey_invalid");
    }
    if (!verification.verified || !verification.registrationInfo) throw badRequest("Couldn't verify the passkey.", "passkey_invalid");

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    if (await Passkey.exists({ credentialId: credential.id })) throw badRequest("This passkey is already registered.", "passkey_exists");

    const firstFactor = !isMfaEnrolled(user);
    const passkey = await Passkey.create({
        user: user._id,
        credentialId: credential.id,
        publicKey: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: name || defaultPasskeyName(req),
    });
    await syncPasskeyCount(user._id);

    // First-time setup: backup codes for when the passkey isn't at hand, and a ticket to finish signing in.
    let backupCodes: string[] | null = null;
    let mfaTicket: string | null = null;
    const set: Record<string, unknown> = {};
    if (firstFactor) {
        const generated = generateBackupCodes();
        backupCodes = generated.codes;
        set.backupCodes = generated.hashes;
    }
    if (!jwt?.mfaVerified) {
        const ticket = generateMfaTicket();
        mfaTicket = ticket.ticket;
        set.mfaTicketHash = ticket.hash;
        set.mfaTicketExpiry = ticket.expiry;
    }
    if (Object.keys(set).length) await User.updateOne({ _id: user._id }, { $set: set });

    return json(
        {
            passkey: { id: passkey._id, name: passkey.name, createdAt: passkey.createdAt, backedUp: passkey.backedUp },
            backupCodes,
            mfaTicket,
        },
        201
    );
});
