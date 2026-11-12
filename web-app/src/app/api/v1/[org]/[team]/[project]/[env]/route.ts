import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadEnvironment, loadOrg, loadProject, loadTeam } from "@/lib/authz";
import { json, route } from "@/lib/http";
import { stringifyDotenv } from "@/lib/dotenv";
import { decrypt } from "@/utils/encryption";
import { assertCanSeeValues } from "@/lib/reveal";

type P = { org: string; team: string; project: string; env: string };

/**
 * CLI/SDK endpoint. Authenticate with `Authorization: Bearer envoy_pat_…`.
 * Access is evaluated live against the token owner's current org/team role.
 *   ?format=json (default) → { vars: { KEY: "value" } }
 *   ?format=dotenv        → text/plain .env file
 */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req, { allowToken: true });
    const ctx = await loadEnvironment(
        await loadProject(await loadTeam(await loadOrg(params.org, me), params.team, me), params.project),
        params.env
    );
    // Tokens are fine; a browser session must have unlocked values like everywhere else.
    await assertCanSeeValues(me);

    const vars = (ctx.environment.vars ?? []).map((v: any) => ({ key: v.key, value: decrypt(v.value) }));

    if (req.nextUrl.searchParams.get("format") === "dotenv") {
        return new NextResponse(stringifyDotenv(vars), {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
    }

    return json({
        org: ctx.org.slug,
        team: ctx.team.slug,
        project: ctx.project.slug,
        environment: ctx.environment.slug,
        version: ctx.environment.version ?? 0,
        vars: Object.fromEntries(vars.map((v: { key: string; value: string }) => [v.key, v.value])),
    });
});
