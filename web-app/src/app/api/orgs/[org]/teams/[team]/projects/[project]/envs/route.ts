import { NextRequest } from "next/server";
import { z } from "zod";
import Environment from "@/models/environment";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertCanEdit, loadOrg, loadProject, loadTeam } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { uniqueSlug } from "@/lib/validation";

const schema = z.object({ name: z.string().trim().min(1).max(32) });

export const POST = route<{ org: string; team: string; project: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const ctx = await loadProject(await loadTeam(await loadOrg(params.org, me), params.team, me), params.project);
    assertCanEdit(ctx.access);
    const { name } = await parseBody(req, schema);

    const count = await Environment.countDocuments({ project: ctx.project._id });
    if (count >= 20) throw badRequest("A project can have at most 20 environments.");
    const slug = await uniqueSlug(name, (s) => Environment.exists({ project: ctx.project._id, slug: s }));
    const env = await Environment.create({ project: ctx.project._id, org: ctx.org._id, name, slug, position: count, vars: [] });
    await audit(ctx.org, me, "env.create", { type: "environment", id: String(env._id), name: `${ctx.team.name}/${ctx.project.name}/${name}` }, undefined, req);

    return json({ environment: { id: env._id, name: env.name, slug: env.slug } }, 201);
});
