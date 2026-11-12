import { NextRequest } from "next/server";
import { z } from "zod";
import Project from "@/models/project";
import Environment, { DEFAULT_ENVIRONMENTS } from "@/models/environment";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertCanEdit, loadOrg, loadTeam, visibleProjectsFilter } from "@/lib/authz";
import { json, parseBody, route } from "@/lib/http";
import { nameSchema, uniqueSlug } from "@/lib/validation";
import { afterFilter, readPage, sortSpec, toPage, type SortField } from "@/lib/pagination";

const PROJECT_SORT: SortField[] = [
    { key: "name", dir: 1, type: "string" },
    { key: "_id", dir: 1, type: "id" },
];

/**
 * The team's projects the caller can see, by name, with environment and variable counts.
 * Paginated; `total` counts every visible one.
 */
export const GET = route<{ org: string; team: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    const { limit, after } = readPage(req, PROJECT_SORT);
    const visible = visibleProjectsFilter(ctx.role, ctx.userId);

    const [rows, total] = await Promise.all([
        Project.find({ team: ctx.team._id, ...visible, ...afterFilter(PROJECT_SORT, after) })
            .sort(sortSpec(PROJECT_SORT))
            .limit(limit + 1),
        Project.countDocuments({ team: ctx.team._id, ...visible }),
    ]);
    const { items, nextCursor } = toPage(rows as any[], limit, (p) => [p.name, p._id]);

    const counts = new Map(
        (
            await Environment.aggregate([
                { $match: { project: { $in: items.map((p) => p._id) } } },
                { $group: { _id: "$project", envs: { $sum: 1 }, vars: { $sum: { $size: "$vars" } } } },
            ])
        ).map((c: any) => [String(c._id), c])
    );

    return json({
        total,
        nextCursor,
        projects: items.map((p) => ({
            id: p._id,
            name: p.name,
            slug: p.slug,
            description: p.description ?? "",
            restricted: !!p.restricted,
            updatedAt: p.updatedAt,
            envCount: counts.get(String(p._id))?.envs ?? 0,
            varCount: counts.get(String(p._id))?.vars ?? 0,
        })),
    });
});

const schema = z.object({ name: nameSchema, description: z.string().trim().max(280).optional() });

/** Editors and admins can create projects; each starts with development/staging/production. */
export const POST = route<{ org: string; team: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadTeam(await loadOrg(params.org, me), params.team, me);
    assertCanEdit(ctx.access);
    const { name, description } = await parseBody(req, schema);

    const slug = await uniqueSlug(name, (s) => Project.exists({ team: ctx.team._id, slug: s }));
    const project = await Project.create({ org: ctx.org._id, team: ctx.team._id, name, slug, description });
    await Environment.insertMany(
        DEFAULT_ENVIRONMENTS.map((e, i) => ({ ...e, position: i, project: project._id, org: ctx.org._id, vars: [] }))
    );
    await audit(ctx.org, me, "project.create", { type: "project", id: String(project._id), name: `${ctx.team.name}/${name}` }, undefined, req);

    return json({ project: { id: project._id, name: project.name, slug: project.slug } }, 201);
});
