import { NextRequest } from "next/server";
import { z } from "zod";
import Project from "@/models/project";
import Environment from "@/models/environment";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertCanEdit, assertOrgAdmin, loadOrg, loadProject, loadTeam } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { nameSchema } from "@/lib/validation";

type P = { org: string; team: string; project: string };

async function load(req: NextRequest, params: P) {
    const me = await requireUser(req);
    const ctx = await loadProject(await loadTeam(await loadOrg(params.org, me), params.team, me), params.project);
    return { me, ctx };
}

export const GET = route<P>(async (req: NextRequest, { params }) => {
    const { ctx } = await load(req, params);
    const envs = await Environment.find({ project: ctx.project._id })
        .select("name slug position version updatedAt vars.key")
        .sort({ position: 1, createdAt: 1 });

    return json({
        project: {
            id: ctx.project._id,
            name: ctx.project.name,
            slug: ctx.project.slug,
            description: ctx.project.description ?? "",
            restricted: !!ctx.project.restricted,
        },
        team: { name: ctx.team.name, slug: ctx.team.slug },
        org: { name: ctx.org.name, slug: ctx.org.slug },
        access: ctx.access,
        environments: envs.map((e: any) => ({
            id: e._id,
            name: e.name,
            slug: e.slug,
            varCount: e.vars?.length ?? 0,
            updatedAt: e.updatedAt,
        })),
    });
});

const patchSchema = z.object({ name: nameSchema.optional(), description: z.string().trim().max(280).optional() });

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const { me, ctx } = await load(req, params);
    assertCanEdit(ctx.access);
    const body = await parseBody(req, patchSchema);
    Object.assign(ctx.project, body);
    await ctx.project.save();
    await audit(ctx.org, me, "project.update", { type: "project", id: String(ctx.project._id), name: `${ctx.team.name}/${ctx.project.name}` }, body, req);
    return json({ message: "Project updated." });
});

const deleteSchema = z.object({ confirm: z.string() });

/** Org owner/admin only; requires typing the project slug. */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const { me, ctx } = await load(req, params);
    assertOrgAdmin(ctx.role);
    const { confirm } = await parseBody(req, deleteSchema);
    if (confirm !== ctx.project.slug) throw badRequest(`Type "${ctx.project.slug}" to confirm.`, "confirm_mismatch");

    await Environment.deleteMany({ project: ctx.project._id });
    await Project.deleteOne({ _id: ctx.project._id });
    await audit(ctx.org, me, "project.delete", { type: "project", id: String(ctx.project._id), name: `${ctx.team.name}/${ctx.project.name}` }, undefined, req);
    return json({ message: "Project deleted." });
});
