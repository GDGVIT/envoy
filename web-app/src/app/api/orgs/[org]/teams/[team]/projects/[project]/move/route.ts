import { NextRequest } from "next/server";
import { z } from "zod";
import { trusted } from "mongoose";
import Project from "@/models/project";
import Team from "@/models/team";
import TeamMembership from "@/models/teamMembership";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg, loadProject, loadTeam } from "@/lib/authz";
import { badRequest, conflict, json, parseBody, route } from "@/lib/http";
import { slugSchema } from "@/lib/validation";

type P = { org: string; team: string; project: string };

const schema = z.object({ teamSlug: slugSchema });

/**
 * Owners and admins: moves a project, with its environments and variables, to another team in the org.
 * Access then follows the new team. For a project limited to selected people, only those who are also on
 * the new team keep access.
 */
export const POST = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadProject(await loadTeam(await loadOrg(params.org, me), params.team, me), params.project);
    assertOrgAdmin(ctx.role);
    const { teamSlug } = await parseBody(req, schema);

    const target = await Team.findOne({ org: ctx.org._id, slug: teamSlug.toLowerCase() });
    if (!target) throw badRequest("That team doesn't exist in this organization.", "team_not_found");
    if (String(target._id) === String(ctx.team._id)) throw badRequest("The project is already in that team.", "same_team");
    if (await Project.exists({ team: target._id, slug: ctx.project.slug })) {
        throw conflict(`${target.name} already has a project at /${ctx.project.slug}. Rename one of them first.`, "slug_taken");
    }

    const project = ctx.project;
    let dropped = 0;
    if (project.restricted && project.allowedUsers?.length) {
        const stay = await TeamMembership.find({ team: target._id, user: trusted({ $in: project.allowedUsers }) }).select("user");
        const keep = stay.map((m: any) => m.user);
        dropped = project.allowedUsers.length - keep.length;
        project.allowedUsers = keep;
    }
    project.team = target._id;
    await project.save();

    await audit(
        ctx.org,
        me,
        "project.move",
        { type: "project", id: String(project._id), name: project.name },
        { from: ctx.team.name, to: target.name, ...(dropped ? { accessRemoved: dropped } : {}) },
        req
    );

    return json({ project: { slug: project.slug }, team: { slug: target.slug, name: target.name } });
});
