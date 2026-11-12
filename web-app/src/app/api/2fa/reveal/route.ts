import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, forbidden, HttpError, json, parseBody, route } from "@/lib/http";
import { verifyTotp } from "@/lib/totp";
import { totpCodeSchema } from "@/lib/validation";
import { REVEAL_TTL_MS, revealUntil } from "@/lib/reveal";
import { decrypt } from "@/utils/encryption";
import { mfaLimiter } from "@/utils/limiter";
import User from "@/models/user";

const schema = z.object({ code: totpCodeSchema });

/** Whether secret values are unlocked for this user, and until when. */
export const GET = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const until = await revealUntil(me);
    return json({ revealUntil: until });
});

/**
 * Unlocks secret values for 10 minutes after a fresh authenticator code. Same replay guard and rate limit
 * as sign-in: a code can't be reused, and 5 wrong tries lock it for 5 minutes.
 */
export const POST = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    if (me.via !== "session") throw forbidden("Unlocking values needs a signed-in session.");
    const { code } = await parseBody(req, schema);

    const full = await User.findById(me.id).select("+totpSecret +totpLastStep totpEnabled");
    if (!full?.totpEnabled || !full.totpSecret) throw badRequest("Two-factor authentication is not set up.", "not_enrolled");

    const limiterKey = `reveal:${me.id}`;
    try {
        await mfaLimiter.consume(limiterKey);
    } catch (e: any) {
        const secs = Math.ceil((e?.msBeforeNext ?? 300000) / 1000);
        throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(secs / 60)} min.`);
    }

    const step = verifyTotp(decrypt(full.totpSecret), code, full.totpLastStep);
    if (step === null) throw badRequest("That code is incorrect or was already used. Wait for the next one.", "invalid_code");
    await mfaLimiter.delete(limiterKey);

    const until = new Date(Date.now() + REVEAL_TTL_MS);
    await User.updateOne({ _id: me.id }, { $set: { totpLastStep: step, revealUntil: until } });
    return json({ revealUntil: until });
});

/** Locks values again right away. */
export const DELETE = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    await User.updateOne({ _id: me.id }, { $unset: { revealUntil: 1 } });
    return json({ revealUntil: null });
});
