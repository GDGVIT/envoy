import { NextRequest } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireUser } from "@/lib/auth";
import { json, notFound, parseBody, route } from "@/lib/http";
import { assertCanRemoveFactor, clearIfNoFactorsLeft, syncPasskeyCount } from "@/lib/passkeys";
import Passkey from "@/models/passkey";
import User from "@/models/user";

type P = { id: string };

async function own(meId: string, id: string) {
    if (!isValidObjectId(id)) throw notFound("Passkey not found.");
    const key = await Passkey.findOne({ _id: id, user: meId });
    if (!key) throw notFound("Passkey not found.");
    return key;
}

const patchSchema = z.object({ name: z.string().trim().min(1, "Give it a name.").max(64) });

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const key = await own(me.id, params.id);
    const { name } = await parseBody(req, patchSchema);
    key.name = name;
    await key.save();
    return json({ passkey: { id: key._id, name: key.name } });
});

/** Removes a passkey (not the last second factor when one of the user's orgs requires 2FA). */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const key = await own(me.id, params.id);
    const user = await User.findById(me.id).select("totpEnabled passkeyCount");
    await assertCanRemoveFactor(me.id, (user?.totpEnabled ? 1 : 0) + Math.max(0, (user?.passkeyCount ?? 0) - 1));
    await key.deleteOne();
    await syncPasskeyCount(me.id);
    await clearIfNoFactorsLeft(me.id);
    return json({ message: "Passkey removed." });
});
