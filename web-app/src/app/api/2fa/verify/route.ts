import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePartialUser } from "@/lib/auth";
import { badRequest, json, parseBody, route, HttpError } from "@/lib/http";
import { consumeBackupCode, generateMfaTicket, verifyTotp } from "@/lib/totp";
import { totpCodeSchema } from "@/lib/validation";
import { decrypt } from "@/utils/encryption";
import { mfaLimiter } from "@/utils/limiter";
import User from "@/models/user";
import { isMfaEnrolled } from "@/lib/passkeys";

const schema = z.union([
    z.object({ code: totpCodeSchema }),
    z.object({ backupCode: z.string().trim().min(8).max(32) }),
]);

/** Login challenge: verify a TOTP or backup code and mint a one-time MFA ticket. */
export const POST = route(async (req: NextRequest) => {
    const { user } = await requirePartialUser(req);
    const body = await parseBody(req, schema);

    const full = await User.findById(user._id).select("+totpSecret +totpLastStep +backupCodes totpEnabled passkeyCount");
    if (!isMfaEnrolled(full)) throw badRequest("Two-factor authentication is not set up.", "not_enrolled");
    if ("code" in body && (!full.totpEnabled || !full.totpSecret)) {
        throw badRequest("There's no authenticator app on this account. Use your passkey or a backup code.", "no_totp");
    }

    const limiterKey = `verify:${user._id}`;
    try {
        await mfaLimiter.consume(limiterKey);
    } catch (e: any) {
        const secs = Math.ceil((e?.msBeforeNext ?? 300000) / 1000);
        throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(secs / 60)} min.`);
    }

    const update: Record<string, unknown> = {};
    let backupCodesRemaining: number | undefined;

    if ("code" in body) {
        const step = verifyTotp(decrypt(full.totpSecret), body.code, full.totpLastStep);
        if (step === null) throw badRequest("Invalid or already-used code.", "invalid_code");
        update.totpLastStep = step;
    } else {
        const remaining = consumeBackupCode(full.backupCodes ?? [], body.backupCode);
        if (!remaining) throw badRequest("Invalid backup code.", "invalid_code");
        update.backupCodes = remaining;
        backupCodesRemaining = remaining.length;
    }

    await mfaLimiter.delete(limiterKey);

    const ticket = generateMfaTicket();
    await User.updateOne(
        { _id: user._id },
        { $set: { ...update, mfaTicketHash: ticket.hash, mfaTicketExpiry: ticket.expiry } }
    );

    return json({ mfaTicket: ticket.ticket, backupCodesRemaining });
});
