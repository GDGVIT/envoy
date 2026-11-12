import { NextRequest } from "next/server";
import { z } from "zod";
import { trusted } from "mongoose";
import Project from "@/models/project";
import OrgMembership from "@/models/orgMembership";
import TeamMembership from "@/models/teamMembership";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg, loadProject, loadTeam } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";

type P = { org: string; team: string; project: string };

/** Owners and admins only: who can open the project. */
async function load(req: NextRequest, params: P) {
    const me = await requireUser(req);
    const ctx = await loadProject(await loadTeam(await loadOrg(params.org, me), params.team, me), params.project);
    assertOrgAdmin(ctx.role);
    return { me, ctx };
}

/**
 * The project's access setting and every team member, each with whether they're allowed in.
 * Members who are org owners or admins are `alwaysAllowed`: they see every project.
 */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const { ctx } = await load(req, params);

    const rows = await TeamMembership.find({ team: ctx.team._id }).populate("user", "name email image").sort({ _id: 1 });
    const members = (rows as any[]).filter((m) => m.user);
    const admins = await OrgMembership.find({
        org: ctx.org._id,
        user: trusted({ $in: members.map((m) => m.user._id) }),
        role: trusted({ $in: ["owner", "admin"] }),
    }).select("user");
    const adminIds = new Set(admins.map((a: any) => String(a.user)));
    const allowed = new Set<string>((ctx.project.allowedUsers ?? []).map((u: unknown) => String(u)));

    return json({
        restricted: !!ctx.project.restricted,
        members: members.map((m) => ({
            userId: m.user._id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image ?? null,
            role: m.role,
            allowed: allowed.has(String(m.user._id)),
            alwaysAllowed: adminIds.has(String(m.user._id)),
        })),
    });
});

const putSchema = z.object({
    restricted: z.boolean(),
    userIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i, "Invalid user id.")).max(1000).default([]),
});

/**
 * Set who can open the project: everyone on the team (`restricted: false`), or only the team
 * members in `userIds`. Owners and admins keep access either way.
 */
export const PUT = route<P>(async (req: NextRequest, { params }) => {
    const { me, ctx } = await load(req, params);
    const body = await parseBody(req, putSchema);

    // "Everyone on the team" keeps no list, so switching back starts from a clean selection.
    const ids = body.restricted ? [...new Set(body.userIds.map((id) => id.toLowerCase()))] : [];
    const memberships = ids.length
        ? await TeamMembership.find({ team: ctx.team._id, user: trusted({ $in: ids }) }).populate("user", "name email")
        : [];
    const found = new Set(memberships.map((m: any) => String(m.user?._id ?? m.user)));
    const outsiders = ids.filter((id) => !found.has(id));
    if (outsiders.length) {
        throw badRequest(
            outsiders.length === 1
                ? `One of the selected people isn't on ${ctx.team.name}. Only team members can be given access.`
                : `${outsiders.length} of the selected people aren't on ${ctx.team.name}. Only team members can be given access.`,
            "not_team_member"
        );
    }

    const wasRestricted = !!ctx.project.restricted;
    const before = new Set<string>((ctx.project.allowedUsers ?? []).map((u: unknown) => String(u)));
    const nameOf = new Map(memberships.map((m: any) => [String(m.user._id), m.user.name ?? m.user.email]));

    // Changing who can see it isn't an edit to the project's contents, so `updatedAt` stays.
    await Project.updateOne(
        { _id: ctx.project._id },
        { $set: { restricted: body.restricted, allowedUsers: ids } },
        { timestamps: false }
    );

    const addedIds = ids.filter((id) => !before.has(id));
    const removedIds = [...before].filter((id) => !ids.includes(id));
    if (wasRestricted !== body.restricted || addedIds.length || removedIds.length) {
        // Names for people who lost access may need a lookup: they're not in this request's list.
        const removedRows = removedIds.length
            ? await TeamMembership.find({ team: ctx.team._id, user: trusted({ $in: removedIds }) }).populate("user", "name email")
            : [];
        const removedNames = new Map(removedRows.map((m: any) => [String(m.user?._id), m.user?.name ?? m.user?.email]));
        await audit(
            ctx.org,
            me,
            "project.access_change",
            { type: "project", id: String(ctx.project._id), name: `${ctx.team.name}/${ctx.project.name}` },
            {
                from: wasRestricted ? "selected" : "everyone",
                to: body.restricted ? "selected" : "everyone",
                allowed: ids.map((id) => nameOf.get(id)),
                added: addedIds.map((id) => nameOf.get(id)),
                removed: removedIds.map((id) => removedNames.get(id) ?? "Former member"),
            },
            req
        );
    }

    return json({
        message: body.restricted ? "Only selected people can open this project." : "Everyone on the team can open this project.",
        restricted: body.restricted,
        allowedCount: ids.length,
    });
});
