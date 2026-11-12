import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import BasicGroup from "@/models/basicGroup";
import { json, parseBody, rateLimit, route } from "@/lib/http";
import { envVarsSchema } from "@/lib/validation";
import { encrypt } from "@/utils/encryption";
import { SHARE_TTL_OPTIONS, withExpiry } from "@/lib/share";

const ALLOWED_TTLS = SHARE_TTL_OPTIONS.map((o) => o.seconds) as number[];

const schema = z.object({
    vars: envVarsSchema.refine((v) => v.length > 0, "Add at least one variable."),
    expiresInSeconds: z
        .number()
        .int()
        .refine((n) => ALLOWED_TTLS.includes(n), "Links can last 10 minutes, 1 hour or 24 hours."),
});

/** Temporary share link (no account required). Always expires, at most 24 hours after creation. */
export const POST = route(async (req: NextRequest) => {
    await rateLimit(req);
    const { vars, expiresInSeconds } = await parseBody(req, schema);

    const expireAt = new Date(Date.now() + expiresInSeconds * 1000);
    const token = withExpiry(randomBytes(18).toString("base64url"), expireAt);
    const share = await BasicGroup.create({
        token,
        envs: vars.map(({ key, value }) => ({ key, value: encrypt(value) })),
        expireAt,
    });

    return json({ token: share.token, expiresAt: share.expireAt }, 201);
});
