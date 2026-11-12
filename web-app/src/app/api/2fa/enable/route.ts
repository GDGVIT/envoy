import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePartialUser } from "@/lib/auth";
import { badRequest, json, parseBody, route, HttpError } from "@/lib/http";
import { generateBackupCodes, generateMfaTicket, verifyTotp } from "@/lib/totp";
import { totpCodeSchema } from "@/lib/validation";
import { decrypt } from "@/utils/encryption";
import { mfaLimiter } from "@/utils/limiter";
import User from "@/models/user";
import { assertCanEnroll, isMfaEnrolled } from "@/lib/passkeys";

const schema = z.object({ code: totpCodeSchema });

/** Confirms enrollment with a first code; returns one-time backup codes and an MFA ticket. */
export const POST = route(async (req: NextRequest) => {
    const { user, jwt } = await requirePartialUser(req);
    const { code } = await parseBody(req, schema);

    const full = await User.findById(user._id).select("+totpPendingSecret totpEnabled passkeyCount");
    if (full.totpEnabled) throw badRequest("An authenticator app is already set up.");
    assertCanEnroll(full, jwt);
    // Someone adding an app next to their passkeys keeps their current backup codes.
    const firstFactor = !isMfaEnrolled(full);
    if (!full.totpPendingSecret) throw badRequest("Start setup first.", "no_pending_secret");

    try {
        await mfaLimiter.consume(`enable:${user._id}`);
    } catch {
        throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
    }

    const secret = decrypt(full.totpPendingSecret);
    const step = verifyTotp(secret, code);
    if (step === null) throw badRequest("That code is incorrect. Check your authenticator's time and try again.", "invalid_code");

    await mfaLimiter.delete(`enable:${user._id}`);

    const { codes, hashes } = generateBackupCodes();
    const ticket = generateMfaTicket();

    await User.updateOne(
        { _id: user._id },
        {
            $set: {
                totpSecret: full.totpPendingSecret,
                totpEnabled: true,
                totpLastStep: step,
                ...(firstFactor ? { backupCodes: hashes } : {}),
                mfaTicketHash: ticket.hash,
                mfaTicketExpiry: ticket.expiry,
            },
            $unset: { totpPendingSecret: 1 },
        }
    );

    return json({ backupCodes: firstFactor ? codes : null, mfaTicket: ticket.ticket });
});
