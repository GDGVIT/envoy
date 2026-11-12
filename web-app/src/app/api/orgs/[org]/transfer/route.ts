import { NextRequest } from "next/server";
import { z } from "zod";
import OrgMembership from "@/models/orgMembership";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgOwner, loadOrg } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";

const schema = z.object({ userId: z.string().min(1) });

/** Transfers ownership to an existing admin; the previous owner becomes an admin. */
export const POST = route<{ org: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgOwner(role);
    const { userId } = await parseBody(req, schema);

    if (userId === me.id) throw badRequest("You already own this organization.");
    const target = await OrgMembership.findOne({ org: org._id, user: userId }).populate("user", "name email");
    if (!target) throw badRequest("That person is not a member of this organization.");
    if (target.role !== "admin") throw badRequest("Make them an admin first, then transfer ownership.", "not_admin");

    await OrgMembership.updateOne({ _id: target._id }, { role: "owner" });
    await OrgMembership.updateOne({ org: org._id, user: me.id }, { role: "admin" });
    org.owner = target.user._id;
    await org.save();

    await audit(org, me, "org.transfer", { type: "user", id: userId, name: target.user.email }, undefined, req);
    return json({ message: `Ownership transferred to ${target.user.name}.` });
});
