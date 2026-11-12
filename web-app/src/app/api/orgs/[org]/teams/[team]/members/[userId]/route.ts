import { NextRequest } from "next/server";
import { z } from "zod";
import TeamMembership from "@/models/teamMembership";
import Project from "@/models/project";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg, loadTeam } from "@/lib/authz";
import { json, notFound, parseBody, route } from "@/lib/http";
import { teamRoleSchema } from "@/lib/validation";

type P = { org: string; team: string; userId: string };

const schema = z.object({ role: teamRoleSchema });

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    assertOrgAdmin(ctx.role);
    const { role } = await parseBody(req, schema);

    const tm = await TeamMembership.findOne({ team: ctx.team._id, user: params.userId }).populate("user", "email");
    if (!tm) throw notFound("Member not found.");
    const from = tm.role;
    tm.role = role;
    await tm.save();
    await audit(ctx.org, me, "team.member_role_change", { type: "team", id: String(ctx.team._id), name: ctx.team.name }, { user: tm.user?.email, from, to: role }, req);

    return json({ message: "Role updated." });
});

export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    assertOrgAdmin(ctx.role);

    const tm = await TeamMembership.findOne({ team: ctx.team._id, user: params.userId }).populate("user", "email");
    if (!tm) throw notFound("Member not found.");
    await TeamMembership.deleteOne({ _id: tm._id });
    // Drop them from the team's "Only selected people" lists, so being added back later doesn't restore access.
    await Project.updateMany(
        { team: ctx.team._id, allowedUsers: params.userId },
        { $pull: { allowedUsers: params.userId } },
        { timestamps: false }
    );
    await audit(ctx.org, me, "team.member_remove", { type: "team", id: String(ctx.team._id), name: ctx.team.name }, { user: tm.user?.email }, req);

    return json({ message: "Removed from team." });
});
