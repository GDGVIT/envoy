import { NextRequest } from "next/server";
import { z } from "zod";
import User from "@/models/user";
import ApiToken from "@/models/apiToken";
import { requireUser } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import { nameSchema } from "@/lib/validation";

export const GET = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const user = await User.findById(me.id).select("name email username image provider emailVerified totpEnabled lastOrgSlug createdAt +backupCodes +password");
    return json({
        user: {
            id: me.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
            username: user.username,
            provider: user.provider,
            emailVerified: !!user.emailVerified,
            totpEnabled: !!user.totpEnabled,
            // Only whether one is set; the hash never leaves the server.
            hasPassword: !!user.password,
            backupCodesRemaining: user.backupCodes?.length ?? 0,
            lastOrgSlug: user.lastOrgSlug ?? null,
            createdAt: user.createdAt,
            apiTokens: await ApiToken.countDocuments({ user: me.id, revokedAt: null }),
        },
    });
});

const patchSchema = z.object({ name: nameSchema.optional(), lastOrgSlug: z.string().max(64).optional() });

export const PATCH = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const body = await parseBody(req, patchSchema);
    await User.updateOne({ _id: me.id }, { $set: body });
    return json({ message: "Profile updated." });
});
