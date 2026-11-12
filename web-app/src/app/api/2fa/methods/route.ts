import { NextRequest } from "next/server";
import { requirePartialUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import User from "@/models/user";

/** Which second factors the signed-in user has, so the sign-in step can offer the right ones. */
export const GET = route(async (req: NextRequest) => {
    const { user } = await requirePartialUser(req);
    const full = await User.findById(user._id).select("totpEnabled passkeyCount +backupCodes");
    return json({
        totp: !!full?.totpEnabled,
        passkeys: full?.passkeyCount ?? 0,
        backupCodes: full?.backupCodes?.length ?? 0,
    });
});
