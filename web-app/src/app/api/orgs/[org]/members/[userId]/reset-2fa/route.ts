import { NextRequest } from "next/server";
import OrgMembership from "@/models/orgMembership";
import User from "@/models/user";
import Passkey from "@/models/passkey";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgOwner, loadOrg } from "@/lib/authz";
import { badRequest, forbidden, json, notFound, route } from "@/lib/http";

/**
 * Owner-only recovery for a member who lost their authenticator and backup codes.
 * Clears their authenticator app and passkeys, revokes all their sessions; they re-enroll after their next password/Google sign-in.
 */
export const POST = route<{ org: string; userId: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgOwner(role);

    if (params.userId === me.id) throw badRequest("You can't reset your own 2FA. Use a backup code instead.");
    const target = await OrgMembership.findOne({ org: org._id, user: params.userId }).populate("user", "name email");
    if (!target) throw notFound("Member not found.");

    // An owner of another org is outside this owner's authority.
    if (await OrgMembership.exists({ user: params.userId, role: "owner" })) {
        throw forbidden("This person owns another organization; their 2FA can't be reset from here.");
    }

    await User.updateOne(
        { _id: params.userId },
        {
            $set: { totpEnabled: false, backupCodes: [], passkeyCount: 0 },
            $unset: { totpSecret: 1, totpPendingSecret: 1, totpLastStep: 1, mfaTicketHash: 1, mfaTicketExpiry: 1, revealUntil: 1 },
            $inc: { sessionVersion: 1 },
        }
    );

    await Passkey.deleteMany({ user: params.userId });

    await audit(org, me, "member.2fa_reset", { type: "user", id: params.userId, name: target.user?.email }, undefined, req);
    return json({ message: `2FA reset for ${target.user?.name}. They'll set it up again at next sign-in.` });
});
