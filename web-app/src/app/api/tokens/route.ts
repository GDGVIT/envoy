import { NextRequest } from "next/server";
import { z } from "zod";
import ApiToken from "@/models/apiToken";
import { generatePat, requireUser } from "@/lib/auth";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { nameSchema } from "@/lib/validation";
import { afterFilter, readPage, sortSpec, toPage, type SortField } from "@/lib/pagination";

const TOKEN_SORT: SortField[] = [{ key: "_id", dir: -1, type: "id" }];

/** The caller's active tokens, newest first. Paginated. */
export const GET = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const { limit, after } = readPage(req, TOKEN_SORT);
    const rows = await ApiToken.find({ user: me.id, revokedAt: null, ...afterFilter(TOKEN_SORT, after) })
        .sort(sortSpec(TOKEN_SORT))
        .limit(limit + 1);
    const { items, nextCursor } = toPage(rows as any[], limit, (t) => [t._id]);
    return json({
        nextCursor,
        tokens: items.map((t: any) => ({
            id: t._id,
            name: t.name,
            prefix: t.prefix,
            createdAt: t.createdAt,
            lastUsedAt: t.lastUsedAt ?? null,
            expiresAt: t.expiresAt ?? null,
        })),
    });
});

const DAY = 24 * 60 * 60 * 1000;

/** Expiry: a preset number of days, a custom date (`expiresAt`, up to a year ahead), or never (`expiresInDays: null`). */
const schema = z
    .object({
        name: nameSchema,
        expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
        expiresAt: z.iso.datetime({ offset: true }).optional(),
    })
    .refine((v) => !v.expiresAt || (Date.parse(v.expiresAt) > Date.now() && Date.parse(v.expiresAt) <= Date.now() + 366 * DAY), {
        message: "Pick an expiry date between tomorrow and one year from now.",
        path: ["expiresAt"],
    });

/** Creates a personal access token. The plaintext is returned exactly once. */
export const POST = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    if (me.via === "token") throw badRequest("API tokens can't create other tokens.");
    const { name, expiresInDays, expiresAt } = await parseBody(req, schema);

    if ((await ApiToken.countDocuments({ user: me.id, revokedAt: null })) >= 25) {
        throw badRequest("You can have at most 25 active tokens. Revoke one first.");
    }

    const { token, hash, prefix } = generatePat();
    const doc = await ApiToken.create({
        user: me.id,
        name,
        prefix,
        tokenHash: hash,
        expiresAt: expiresAt ? new Date(expiresAt) : expiresInDays ? new Date(Date.now() + expiresInDays * DAY) : undefined,
    });

    return json({ token, id: doc._id, prefix, expiresAt: doc.expiresAt ?? null }, 201);
});
