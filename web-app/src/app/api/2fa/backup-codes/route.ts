import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, json, parseBody, route, HttpError } from "@/lib/http";
import { generateBackupCodes, verifyTotp } from "@/lib/totp";
import { totpCodeSchema } from "@/lib/validation";
import { decrypt } from "@/utils/encryption";
import { mfaLimiter } from "@/utils/limiter";
import User from "@/models/user";

const schema = z.object({ code: totpCodeSchema });

/** Regenerates backup codes (invalidating old ones). Requires a fresh TOTP code. */
export const POST = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const { code } = await parseBody(req, schema);

    try {
        await mfaLimiter.consume(`regen:${me.id}`);
    } catch {
        throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
    }

    const user = await User.findById(me.id).select("+totpSecret +totpLastStep");
    const step = verifyTotp(decrypt(user.totpSecret), code, user.totpLastStep);
    if (step === null) throw badRequest("Invalid or already-used code.", "invalid_code");

    const { codes, hashes } = generateBackupCodes();
    await User.updateOne({ _id: me.id }, { backupCodes: hashes, totpLastStep: step });
    await mfaLimiter.delete(`regen:${me.id}`);

    return json({ backupCodes: codes });
});
