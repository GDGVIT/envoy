import { NextRequest } from "next/server";
import { Types, trusted } from "mongoose";
import AuditLog from "@/models/auditLog";
import { requireUser } from "@/lib/auth";
import { assertOrgAdmin, loadOrg } from "@/lib/authz";
import { json, route } from "@/lib/http";
import { afterFilter, readPage, sortSpec, toPage, type SortField } from "@/lib/pagination";

const AUDIT_SORT: SortField[] = [{ key: "_id", dir: -1, type: "id" }];

/** Owner/admin only. Paginated like every list (newest first), filterable by action prefix, actor and text. */
export const GET = route<{ org: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);

    const { limit, after } = readPage(req, AUDIT_SORT);
    const sp = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = { org: org._id };

    const action = sp.get("action");
    if (action) filter.action = trusted({ $regex: `^${action.replace(/[^a-z0-9_.]/gi, "")}` });

    const actor = sp.get("actor");
    if (actor && Types.ObjectId.isValid(actor)) filter.actor = new Types.ObjectId(actor);

    const q = sp.get("q")?.trim();
    if (q) {
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 64);
        filter.$or = [{ actorEmail: trusted({ $regex: safe, $options: "i" }) }, { "target.name": trusted({ $regex: safe, $options: "i" }) }];
    }

    // The text search uses $or too, so combine it with the cursor condition through $and.
    const query = after ? { $and: [filter, afterFilter(AUDIT_SORT, after)] } : filter;
    const rows = await AuditLog.find(query).sort(sortSpec(AUDIT_SORT)).limit(limit + 1).lean();
    const { items: page, nextCursor } = toPage(rows as any[], limit, (e) => [e._id]);

    return json({
        entries: page.map((e: any) => ({
            id: e._id,
            action: e.action,
            actor: e.actor ? { id: e.actor, name: e.actorName, email: e.actorEmail } : null,
            target: e.target ?? null,
            meta: e.meta ?? null,
            ip: e.ip ?? null,
            createdAt: e.createdAt,
        })),
        nextCursor,
    });
});
