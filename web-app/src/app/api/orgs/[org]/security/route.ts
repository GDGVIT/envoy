import { NextRequest } from "next/server";
import { z } from "zod";
import OrgMembership from "@/models/orgMembership";
import User from "@/models/user";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgOwner, isOrgAdmin, loadOrg, requires2fa } from "@/lib/authz";
import { badRequest, json, parseBody, route } from "@/lib/http";

type P = { org: string };

/** Members who have neither a passkey nor an authenticator app. */
async function membersWithout2fa(orgId: unknown) {
    const rows = await OrgMembership.aggregate([
        { $match: { org: orgId } },
        { $lookup: { from: User.collection.name, localField: "user", foreignField: "_id", as: "u" } },
        { $unwind: "$u" },
        { $match: { "u.totpEnabled": { $ne: true }, $or: [{ "u.passkeyCount": { $exists: false } }, { "u.passkeyCount": { $lte: 0 } }] } },
        { $sort: { "u.name": 1 } },
        { $project: { _id: 0, name: "$u.name", email: "$u.email", image: "$u.image" } },
    ]);
    return rows as { name: string; email: string; image?: string | null }[];
}

/** The org's two-factor requirement, and (for owners and admins) who hasn't set 2FA up yet. */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    const without = isOrgAdmin(role) ? await membersWithout2fa(org._id) : null;
    return json({ require2fa: requires2fa(org), membersWithout2fa: without });
});

const schema = z.object({ require2fa: z.boolean() });

/**
 * Owner only. Turning it on locks members without 2FA out of the org until they add a passkey or an
 * authenticator app; turning it off never removes anyone's passkeys or apps.
 */
export const PATCH = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgOwner(role);
    const { require2fa } = await parseBody(req, schema);
    if (require2fa && !me.mfa) {
        throw badRequest("Set up a passkey or an authenticator app for yourself first, so you aren't locked out.", "owner_needs_2fa");
    }

    const before = requires2fa(org);
    org.require2fa = require2fa;
    await org.save();
    if (before !== require2fa) {
        await audit(org, me, require2fa ? "org.2fa_required" : "org.2fa_optional", { type: "org", id: String(org._id), name: org.name }, undefined, req);
    }
    return json({ require2fa, membersWithout2fa: await membersWithout2fa(org._id) });
});
