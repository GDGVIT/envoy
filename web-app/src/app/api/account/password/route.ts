import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { passwordSchema } from "@/lib/validation";
import { comparePassword, hashPassword } from "@/utils/bcrypt";
import User from "@/models/user";

const schema = z.object({ currentPassword: z.string().optional(), newPassword: passwordSchema });

/**
 * Sets a first password (accounts start with Google sign-in only), after which email + password sign-in
 * works too; or changes it, which signs out every session including this one.
 */
export const POST = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const { currentPassword, newPassword } = await parseBody(req, schema);

    const user = await User.findById(me.id).select("+password provider");
    if (!user.password) {
        await User.updateOne({ _id: me.id }, { $set: { password: await hashPassword(newPassword) } });
        return json({ message: "Password set. You can now sign in with your email and password too.", signedOut: false });
    }
    if (!currentPassword || !(await comparePassword(currentPassword, user.password))) {
        throw badRequest("Current password is incorrect.", "invalid_password");
    }

    await User.updateOne(
        { _id: me.id },
        { $set: { password: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 }, $unset: { revealUntil: 1 } }
    );
    return json({ message: "Password changed. Please sign in again.", signedOut: true });
});
