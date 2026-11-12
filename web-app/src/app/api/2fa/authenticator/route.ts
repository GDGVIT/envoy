import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, json, route } from "@/lib/http";
import { assertCanRemoveFactor, clearIfNoFactorsLeft } from "@/lib/passkeys";
import User from "@/models/user";

/** Removes the authenticator app (not when it's the last second factor and an org requires 2FA). */
export const DELETE = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const user = await User.findById(me.id).select("totpEnabled passkeyCount");
    if (!user?.totpEnabled) throw badRequest("There's no authenticator app on this account.");
    await assertCanRemoveFactor(me.id, user.passkeyCount ?? 0);
    await User.updateOne(
        { _id: me.id },
        { $set: { totpEnabled: false }, $unset: { totpSecret: 1, totpPendingSecret: 1, totpLastStep: 1 } }
    );
    await clearIfNoFactorsLeft(me.id);
    return json({ message: "Authenticator app removed." });
});
