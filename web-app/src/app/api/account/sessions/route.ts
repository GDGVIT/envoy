import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import User from "@/models/user";

/** Signs out every session for this account, everywhere. */
export const DELETE = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    await User.updateOne({ _id: me.id }, { $inc: { sessionVersion: 1 }, $unset: { revealUntil: 1 } });
    return json({ message: "Signed out of all sessions." });
});
