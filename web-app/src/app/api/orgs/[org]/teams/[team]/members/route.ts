import { NextRequest } from "next/server";
import { z } from "zod";
import OrgMembership from "@/models/orgMembership";
import TeamMembership from "@/models/teamMembership";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg, loadTeam } from "@/lib/authz";
import { badRequest, conflict, json, parseBody, route } from "@/lib/http";
import { teamRoleSchema } from "@/lib/validation";
import { afterFilter, readPage, sortSpec, toPage, type SortField } from "@/lib/pagination";

const MEMBER_SORT: SortField[] = [{ key: "_id", dir: 1, type: "id" }];

/** People on the team, in the order they were added. Paginated; `total` counts them all. */
export const GET = route<{ org: string; team: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    const { limit, after } = readPage(req, MEMBER_SORT);

    const [rows, total] = await Promise.all([
        TeamMembership.find({ team: ctx.team._id, ...afterFilter(MEMBER_SORT, after) })
            .populate("user", "name email image")
            .sort(sortSpec(MEMBER_SORT))
            .limit(limit + 1),
        TeamMembership.countDocuments({ team: ctx.team._id }),
    ]);
    const { items, nextCursor } = toPage(rows as any[], limit, (m) => [m._id]);

    return json({
        total,
        nextCursor,
        members: items
            .filter((m) => m.user)
            .map((m) => ({ userId: m.user._id, name: m.user.name, email: m.user.email, image: m.user.image ?? null, role: m.role })),
    });
});

const schema = z.object({ userId: z.string().min(1), role: teamRoleSchema });

/** Add an existing org member to the team. People outside the org are invited instead. */
export const POST = route<{ org: string; team: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    assertOrgAdmin(ctx.role);
    const { userId, role } = await parseBody(req, schema);

    const orgMember = await OrgMembership.findOne({ org: ctx.org._id, user: userId }).populate("user", "name email");
    if (!orgMember) throw badRequest("Invite this person to the organization first.", "not_org_member");
    if (await TeamMembership.exists({ team: ctx.team._id, user: userId })) {
        throw conflict("Already a member of this team.", "already_member");
    }

    await TeamMembership.create({ team: ctx.team._id, org: ctx.org._id, user: userId, role });
    await audit(ctx.org, me, "team.member_add", { type: "team", id: String(ctx.team._id), name: ctx.team.name }, { user: orgMember.user?.email, role }, req);

    return json({ message: "Added to team." }, 201);
});
