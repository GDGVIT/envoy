import { NextRequest } from "next/server";
import OrgMembership from "@/models/orgMembership";
import TeamMembership from "@/models/teamMembership";
import User from "@/models/user";
import { requireUser } from "@/lib/auth";
import { loadOrg } from "@/lib/authz";
import { json, route } from "@/lib/http";
import { afterMatch, readPage, toPage, type SortField } from "@/lib/pagination";
import { trusted } from "mongoose";

/** Owners first, then admins, then members; by name within a role. */
const MEMBER_SORT: SortField[] = [
    { key: "rank", dir: 1, type: "number" },
    { key: "nameKey", dir: 1, type: "string" },
    { key: "_id", dir: 1, type: "id" },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Organization members, paginated. `?q=` filters by name or email (case-insensitive).
 * `total` is the number of members matching `q` (or all members without it).
 */
export const GET = route<{ org: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org } = await loadOrg(params.org, me);
    const { limit, after } = readPage(req, MEMBER_SORT);
    const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";

    const base = [
        { $match: { org: org._id } },
        { $lookup: { from: User.collection.name, localField: "user", foreignField: "_id", as: "u" } },
        { $unwind: "$u" },
        ...(q ? [{ $match: { $or: [{ "u.name": { $regex: escapeRegex(q), $options: "i" } }, { "u.email": { $regex: escapeRegex(q), $options: "i" } }] } }] : []),
    ];

    const [rows, counted] = await Promise.all([
        OrgMembership.aggregate([
            ...base,
            {
                $addFields: {
                    rank: { $switch: { branches: [{ case: { $eq: ["$role", "owner"] }, then: 0 }, { case: { $eq: ["$role", "admin"] }, then: 1 }], default: 2 } },
                    nameKey: { $toLower: "$u.name" },
                },
            },
            { $match: afterMatch(MEMBER_SORT, after) },
            { $sort: { rank: 1, nameKey: 1, _id: 1 } },
            { $limit: limit + 1 },
        ]),
        OrgMembership.aggregate([...base, { $count: "n" }]),
    ]);
    const { items, nextCursor } = toPage(rows as any[], limit, (m) => [m.rank, m.nameKey, m._id]);

    // Team memberships for this page's members only.
    const teamMemberships = await TeamMembership.find({ org: org._id, user: trusted({ $in: items.map((m) => m.u._id) }) }).populate("team", "name slug");
    const teamsByUser = new Map<string, { name: string; slug: string; role: string }[]>();
    for (const tm of teamMemberships as any[]) {
        if (!tm.team) continue;
        const list = teamsByUser.get(String(tm.user)) ?? [];
        list.push({ name: tm.team.name, slug: tm.team.slug, role: tm.role });
        teamsByUser.set(String(tm.user), list);
    }

    return json({
        total: counted[0]?.n ?? 0,
        nextCursor,
        members: items.map((m) => ({
            userId: m.u._id,
            name: m.u.name,
            email: m.u.email,
            image: m.u.image ?? null,
            provider: m.u.provider,
            // Has a second factor: an authenticator app or a passkey.
            totpEnabled: !!m.u.totpEnabled || (m.u.passkeyCount ?? 0) > 0,
            role: m.role,
            joinedAt: m.createdAt,
            teams: teamsByUser.get(String(m.u._id)) ?? [],
            isMe: String(m.u._id) === me.id,
        })),
    });
});
