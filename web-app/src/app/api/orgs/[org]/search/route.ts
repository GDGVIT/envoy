import { NextRequest } from "next/server";
import { trusted } from "mongoose";
import Team from "@/models/team";
import Project from "@/models/project";
import Environment from "@/models/environment";
import { requireUser } from "@/lib/auth";
import { loadOrg, visibleProjectsFilter, visibleTeamIds } from "@/lib/authz";
import { json, route } from "@/lib/http";

type P = { org: string };

const LIMIT = 12;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Command menu search across what the caller can see: environments (by name) and variables (by KEY).
 * Only names are searched and returned, never values; teams and projects are matched in the browser
 * from the navigation tree it already has.
 */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 64);
    if (q.length < 2) return json({ environments: [], variables: [] });

    const teamIds = await visibleTeamIds(org._id, role, me.id);
    const [teams, projects] = await Promise.all([
        Team.find({ _id: trusted({ $in: teamIds }) }).select("name slug"),
        Project.find({ team: trusted({ $in: teamIds }), ...visibleProjectsFilter(role, me.id) }).select("name slug team"),
    ]);
    if (!projects.length) return json({ environments: [], variables: [] });

    const teamById = new Map(teams.map((t: any) => [String(t._id), t]));
    const projectById = new Map(projects.map((p: any) => [String(p._id), p]));
    const projectIds = projects.map((p: any) => p._id);
    const pattern = new RegExp(escapeRegex(q), "i");

    const [envs, vars] = await Promise.all([
        Environment.find({ project: trusted({ $in: projectIds }), name: trusted({ $regex: pattern }) })
            .select("name slug project")
            .limit(LIMIT),
        Environment.aggregate([
            { $match: { project: { $in: projectIds }, "vars.key": { $regex: pattern } } },
            { $unwind: "$vars" },
            { $match: { "vars.key": { $regex: pattern } } },
            // Exact and prefix matches first, then the rest alphabetically.
            {
                $addFields: {
                    rank: {
                        $cond: [
                            { $eq: [{ $toLower: "$vars.key" }, q.toLowerCase()] },
                            0,
                            { $cond: [{ $eq: [{ $indexOfCP: [{ $toLower: "$vars.key" }, q.toLowerCase()] }, 0] }, 1, 2] },
                        ],
                    },
                },
            },
            { $sort: { rank: 1, "vars.key": 1, position: 1 } },
            { $limit: LIMIT * 2 },
            { $project: { _id: 0, key: "$vars.key", project: 1, name: 1, slug: 1 } },
        ]),
    ]);

    const place = (projectId: unknown) => {
        const p: any = projectById.get(String(projectId));
        const t: any = p && teamById.get(String(p.team));
        return p && t ? { project: { name: p.name, slug: p.slug }, team: { name: t.name, slug: t.slug } } : null;
    };

    return json({
        environments: envs.flatMap((e: any) => {
            const at = place(e.project);
            return at ? [{ name: e.name, slug: e.slug, ...at }] : [];
        }),
        variables: vars.flatMap((v: any) => {
            const at = place(v.project);
            return at ? [{ key: v.key, env: { name: v.name, slug: v.slug }, ...at }] : [];
        }).slice(0, LIMIT),
    });
});
