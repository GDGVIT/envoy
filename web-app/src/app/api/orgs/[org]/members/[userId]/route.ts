import { NextRequest } from "next/server";
import { z } from "zod";
import OrgMembership from "@/models/orgMembership";
import TeamMembership from "@/models/teamMembership";
import Project from "@/models/project";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg } from "@/lib/authz";
import { badRequest, forbidden, json, notFound, parseBody, route } from "@/lib/http";
import { orgRoleSchema } from "@/lib/validation";

type P = { org: string; userId: string };

const schema = z.object({ role: orgRoleSchema });

/** Change a member's org role. Only the owner can grant/revoke admin. */
export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);
    const { role: newRole } = await parseBody(req, schema);

    if (params.userId === me.id) throw badRequest("You can't change your own role.");
    const target = await OrgMembership.findOne({ org: org._id, user: params.userId }).populate("user", "name email");
    if (!target) throw notFound("Member not found.");
    if (target.role === "owner") throw forbidden("Use ownership transfer to change the owner's role.");
    if ((target.role === "admin" || newRole === "admin") && role !== "owner") {
        throw forbidden("Only the owner can grant or remove admin access.");
    }
    if (target.role === newRole) return json({ message: "No change." });

    const from = target.role;
    target.role = newRole;
    await target.save();
    await audit(org, me, "member.role_change", { type: "user", id: params.userId, name: target.user?.email }, { from, to: newRole }, req);

    return json({ message: "Role updated." });
});

/** Remove a member (admin+) or leave the org (`userId = me`). Cascades team memberships. */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const leaving = params.userId === "me" || params.userId === me.id;
    // Leaving never needs the org's 2FA requirement to be met.
    const { org, role } = await loadOrg(params.org, me, { skip2fa: leaving });
    const targetId = leaving ? me.id : params.userId;

    const target = await OrgMembership.findOne({ org: org._id, user: targetId }).populate("user", "name email");
    if (!target) throw notFound("Member not found.");

    if (leaving) {
        if (role === "owner") throw badRequest("Transfer ownership before leaving the organization.", "owner_cannot_leave");
    } else {
        assertOrgAdmin(role);
        if (target.role === "owner") throw forbidden("The owner can't be removed.");
        if (target.role === "admin" && role !== "owner") throw forbidden("Only the owner can remove admins.");
    }

    await TeamMembership.deleteMany({ org: org._id, user: targetId });
    // Drop them from every "Only selected people" list in the org, so rejoining doesn't restore access.
    await Project.updateMany({ org: org._id, allowedUsers: targetId }, { $pull: { allowedUsers: targetId } }, { timestamps: false });
    await OrgMembership.deleteOne({ _id: target._id });
    await audit(
        org,
        me,
        leaving ? "member.leave" : "member.remove",
        { type: "user", id: targetId, name: target.user?.email },
        undefined,
        req
    );

    return json({ message: leaving ? "You left the organization." : "Member removed." });
});
