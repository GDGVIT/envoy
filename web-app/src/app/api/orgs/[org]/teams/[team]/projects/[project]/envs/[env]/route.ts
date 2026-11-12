import { NextRequest } from "next/server";
import { z } from "zod";
import Environment from "@/models/environment";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertCanEdit, assertOrgAdmin, loadEnvironment, loadOrg, loadProject, loadTeam } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { decrypt } from "@/utils/encryption";
import User from "@/models/user";
import { revealRequired, revealUntil } from "@/lib/reveal";

type P = { org: string; team: string; project: string; env: string };

async function load(req: NextRequest, params: P) {
    const me = await requireUser(req);
    const ctx = await loadEnvironment(
        await loadProject(await loadTeam(await loadOrg(params.org, me), params.team, me), params.project),
        params.env
    );
    return { me, ctx };
}

/**
 * One environment's variables. Values are only included while the caller has unlocked them with a fresh
 * authenticator code (see lib/reveal); otherwise each value is null and only key names are sent.
 */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const { me, ctx } = await load(req, params);
    const until = await revealUntil(me);
    const required = revealRequired(me);
    const show = !required || !!until;
    const env = ctx.environment;
    const updatedBy = env.updatedBy ? await User.findById(env.updatedBy).select("name") : null;

    return json({
        environment: {
            id: env._id,
            name: env.name,
            slug: env.slug,
            version: env.version ?? 0,
            updatedAt: env.updatedAt,
            updatedBy: updatedBy?.name ?? null,
            vars: (env.vars ?? []).map((v: any) => ({ key: v.key, value: show ? decrypt(v.value) : null })),
        },
        access: ctx.access,
        revealUntil: until,
        /** False for people without 2FA: their values come unlocked, with no timer. */
        revealRequired: required,
    });
});

const patchSchema = z.object({ name: z.string().trim().min(1).max(32) });

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const { me, ctx } = await load(req, params);
    assertCanEdit(ctx.access);
    const { name } = await parseBody(req, patchSchema);
    const from = ctx.environment.name;
    ctx.environment.name = name;
    await ctx.environment.save();
    await audit(ctx.org, me, "env.update", { type: "environment", id: String(ctx.environment._id), name: `${ctx.team.name}/${ctx.project.name}/${name}` }, { from, to: name }, req);
    return json({ message: "Environment renamed." });
});

/** Owner/admin only; the last environment of a project can't be deleted. */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
    const { me, ctx } = await load(req, params);
    assertOrgAdmin(ctx.role);
    if ((await Environment.countDocuments({ project: ctx.project._id })) <= 1) {
        throw badRequest("A project needs at least one environment.");
    }
    await Environment.deleteOne({ _id: ctx.environment._id });
    await audit(ctx.org, me, "env.delete", { type: "environment", id: String(ctx.environment._id), name: `${ctx.team.name}/${ctx.project.name}/${ctx.environment.name}` }, { vars: ctx.environment.vars?.length ?? 0 }, req);
    return json({ message: "Environment deleted." });
});
