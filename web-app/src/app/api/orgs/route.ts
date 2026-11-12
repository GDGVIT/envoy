import { NextRequest } from "next/server";
import { z } from "zod";
import Organization from "@/models/organization";
import OrgMembership from "@/models/orgMembership";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, parseBody, route } from "@/lib/http";
import { nameSchema, slugSchema, uniqueSlug } from "@/lib/validation";
import { conflict } from "@/lib/http";
import { afterFilter, readPage, sortSpec, toPage, type SortField } from "@/lib/pagination";

const ORG_SORT: SortField[] = [{ key: "_id", dir: 1, type: "id" }];

/** Organizations the caller belongs to, with their role, oldest membership first. Paginated. */
export const GET = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const { limit, after } = readPage(req, ORG_SORT);
    const rows = await OrgMembership.find({ user: me.id, ...afterFilter(ORG_SORT, after) })
        .populate("org", "name slug")
        .sort(sortSpec(ORG_SORT))
        .limit(limit + 1);
    const { items, nextCursor } = toPage(rows as any[], limit, (m) => [m._id]);
    return json({
        orgs: items.filter((m: any) => m.org).map((m: any) => ({ id: m.org._id, name: m.org.name, slug: m.org.slug, role: m.role })),
        nextCursor,
    });
});

const createSchema = z.object({ name: nameSchema, slug: slugSchema.optional() });

export const POST = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const { name, slug: requested } = await parseBody(req, createSchema);

    let slug: string;
    if (requested) {
        if (await Organization.exists({ slug: requested })) throw conflict("That URL is already taken.", "slug_taken");
        slug = requested;
    } else {
        slug = await uniqueSlug(name, (s) => Organization.exists({ slug: s }));
    }

    // New organizations start without the 2FA requirement; the owner can turn it on in settings.
    const org = await Organization.create({ name, slug, owner: me.id, require2fa: false });
    await OrgMembership.create({ org: org._id, user: me.id, role: "owner" });
    await audit(org, me, "org.create", { type: "org", id: String(org._id), name });

    return json({ org: { id: org._id, name: org.name, slug: org.slug, role: "owner" } }, 201);
});
