import { NextRequest } from "next/server";
import { z } from "zod";
import Team from "@/models/team";
import TeamMembership from "@/models/teamMembership";
import Project from "@/models/project";
import Environment from "@/models/environment";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg, loadTeam, visibleProjectsFilter } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { nameSchema } from "@/lib/validation";
import { trusted } from "mongoose";

type P = { org: string; team: string };

/** Team details and counts. Its projects and members are paginated at /projects and /members. */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);

    const [projectCount, memberCount] = await Promise.all([
        Project.countDocuments({ team: ctx.team._id, ...visibleProjectsFilter(ctx.role, ctx.userId) }),
        TeamMembership.countDocuments({ team: ctx.team._id }),
    ]);

    return json({
        team: {
            id: ctx.team._id,
            name: ctx.team.name,
            slug: ctx.team.slug,
            description: ctx.team.description ?? "",
            access: ctx.access,
            myRole: ctx.teamRole,
        },
        orgRole: ctx.role,
        projectCount,
        memberCount,
    });
});

const patchSchema = z.object({ name: nameSchema.optional(), description: z.string().trim().max(280).optional() });

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    assertOrgAdmin(ctx.role);
    const body = await parseBody(req, patchSchema);

    Object.assign(ctx.team, body);
    await ctx.team.save();
    await audit(ctx.org, me, "team.update", { type: "team", id: String(ctx.team._id), name: ctx.team.name }, body, req);
    return json({ team: { id: ctx.team._id, name: ctx.team.name, slug: ctx.team.slug } });
});

const deleteSchema = z.object({ confirm: z.string().optional() });

/** Deleting a team with projects requires typing its slug; cascades projects and environments. */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    assertOrgAdmin(ctx.role);
    const { confirm } = await parseBody(req, deleteSchema);

    const projectIds = (await Project.find({ team: ctx.team._id }).select("_id")).map((p: any) => p._id);
    if (projectIds.length && confirm !== ctx.team.slug) {
        throw badRequest(`This team has ${projectIds.length} project(s). Type "${ctx.team.slug}" to confirm.`, "confirm_mismatch");
    }

    await Environment.deleteMany({ project: trusted({ $in: projectIds }) });
    await Project.deleteMany({ team: ctx.team._id });
    await TeamMembership.deleteMany({ team: ctx.team._id });
    await Team.deleteOne({ _id: ctx.team._id });
    await audit(ctx.org, me, "team.delete", { type: "team", id: String(ctx.team._id), name: ctx.team.name }, { projects: projectIds.length }, req);

    return json({ message: "Team deleted." });
});
