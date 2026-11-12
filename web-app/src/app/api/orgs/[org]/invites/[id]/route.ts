import { NextRequest } from "next/server";
import Invite from "@/models/invite";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg } from "@/lib/authz";
import { json, notFound, route } from "@/lib/http";

export const DELETE = route<{ org: string; id: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);

    const invite = await Invite.findOne({ _id: params.id, org: org._id });
    if (!invite) throw notFound("Invite not found.");
    if (!invite.revokedAt) {
        invite.revokedAt = new Date();
        await invite.save();
        await audit(org, me, "invite.revoke", { type: "invite", id: String(invite._id), name: invite.email ?? "invite link" }, undefined, req);
    }
    return json({ message: "Invite revoked." });
});
