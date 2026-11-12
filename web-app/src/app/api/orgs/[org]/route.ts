import { NextRequest } from "next/server";
import { z } from "zod";
import Organization from "@/models/organization";
import OrgMembership from "@/models/orgMembership";
import Team from "@/models/team";
import TeamMembership from "@/models/teamMembership";
import Project from "@/models/project";
import Environment from "@/models/environment";
import Invite from "@/models/invite";
import AuditLog from "@/models/auditLog";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, assertOrgOwner, isOrgAdmin, loadOrg, visibleProjectsFilter, visibleTeamIds } from "@/lib/authz";
import { badRequest, conflict, json, parseBody, route } from "@/lib/http";
import { nameSchema, slugSchema } from "@/lib/validation";
import { trusted } from "mongoose";

type P = { org: string };

/** Org overview + the navigation tree (teams → projects) visible to the caller. */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);

    const teamIds = await visibleTeamIds(org._id, role, me.id);
    const [teams, projects, myTeamRoles, memberCount] = await Promise.all([
        Team.find({ _id: trusted({ $in: teamIds }) }).sort({ name: 1 }),
        Project.find({ team: trusted({ $in: teamIds }), ...visibleProjectsFilter(role, me.id) })
            .select("name slug team updatedAt restricted")
            .sort({ name: 1 }),
        TeamMembership.find({ org: org._id, user: me.id }).select("team role"),
        OrgMembership.countDocuments({ org: org._id }),
    ]);
    const memberCounts = await TeamMembership.aggregate([
        { $match: { team: { $in: teamIds } } },
        { $group: { _id: "$team", count: { $sum: 1 } } },
    ]);

    const roleByTeam = new Map(myTeamRoles.map((m: any) => [String(m.team), m.role]));
    const countByTeam = new Map(memberCounts.map((m: any) => [String(m._id), m.count]));

    return json({
        org: { id: org._id, name: org.name, slug: org.slug, role, memberCount, createdAt: org.createdAt },
        teams: teams.map((t: any) => ({
            id: t._id,
            name: t.name,
            slug: t.slug,
            description: t.description ?? "",
            myRole: roleByTeam.get(String(t._id)) ?? null,
            access: isOrgAdmin(role) ? "manage" : roleByTeam.get(String(t._id)) === "editor" ? "edit" : "view",
            memberCount: countByTeam.get(String(t._id)) ?? 0,
            projects: projects
                .filter((p: any) => String(p.team) === String(t._id))
                .map((p: any) => ({ id: p._id, name: p.name, slug: p.slug, updatedAt: p.updatedAt, restricted: !!p.restricted })),
        })),
    });
});

const patchSchema = z.object({ name: nameSchema.optional(), slug: slugSchema.optional() });

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);
    const body = await parseBody(req, patchSchema);

    if (body.slug && body.slug !== org.slug) {
        if (await Organization.exists({ slug: body.slug })) throw conflict("That URL is already taken.", "slug_taken");
    }
    const before = { name: org.name, slug: org.slug };
    Object.assign(org, body);
    await org.save();
    await audit(org, me, "org.update", { type: "org", id: String(org._id), name: org.name }, { before, after: body }, req);

    return json({ org: { id: org._id, name: org.name, slug: org.slug, role } });
});

const deleteSchema = z.object({ confirm: z.string() });

/** Owner only. Requires typing the org slug; deletes everything in the org. */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgOwner(role);
    const { confirm } = await parseBody(req, deleteSchema);
    if (confirm !== org.slug) throw badRequest(`Type "${org.slug}" to confirm.`, "confirm_mismatch");

    await Promise.all([
        Environment.deleteMany({ org: org._id }),
        Project.deleteMany({ org: org._id }),
        TeamMembership.deleteMany({ org: org._id }),
        Team.deleteMany({ org: org._id }),
        Invite.deleteMany({ org: org._id }),
        AuditLog.deleteMany({ org: org._id }),
        OrgMembership.deleteMany({ org: org._id }),
    ]);
    await Organization.deleteOne({ _id: org._id });

    return json({ message: "Organization deleted." });
});
