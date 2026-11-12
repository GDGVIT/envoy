import { NextRequest } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import Invite from "@/models/invite";
import Team from "@/models/team";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg } from "@/lib/authz";
import { badRequest, forbidden, json, parseBody, route } from "@/lib/http";
import { orgRoleSchema, teamRoleSchema } from "@/lib/validation";
import { sha256 } from "@/lib/totp";
import { afterFilter, readPage, sortSpec, toPage, type SortField } from "@/lib/pagination";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@/lib/invite-code";

/** A fresh 10-character invite code that no other invite uses. */
async function newInviteCode() {
    for (;;) {
        let code = "";
        for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
        if (!(await Invite.exists({ tokenHash: sha256(code) }))) return code;
    }
}

type P = { org: string };

function serialize(invite: any) {
    const now = Date.now();
    const status = invite.revokedAt
        ? "revoked"
        : invite.expiresAt.getTime() < now
          ? "expired"
          : invite.maxUses && invite.uses >= invite.maxUses
            ? invite.kind === "email" ? "accepted" : "used_up"
            : "active";
    return {
        id: invite._id,
        kind: invite.kind,
        email: invite.email ?? null,
        orgRole: invite.orgRole,
        team: invite.team ? { name: invite.team.name, slug: invite.team.slug } : null,
        teamRole: invite.teamRole ?? null,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses ?? null,
        uses: invite.uses,
        createdBy: invite.createdBy?.name ?? null,
        createdAt: invite.createdAt,
        status,
    };
}

const INVITE_SORT: SortField[] = [{ key: "_id", dir: -1, type: "id" }];

/** The org's invites, newest first. Owners and admins only. Paginated. */
export const GET = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);
    const { limit, after } = readPage(req, INVITE_SORT);
    const rows = await Invite.find({ org: org._id, ...afterFilter(INVITE_SORT, after) })
        .populate("team", "name slug")
        .populate("createdBy", "name")
        .sort(sortSpec(INVITE_SORT))
        .limit(limit + 1);
    const { items, nextCursor } = toPage(rows as any[], limit, (i) => [i._id]);
    return json({ invites: items.map(serialize), nextCursor });
});

// Invitations are shareable links only; Envoy doesn't send email.
const schema = z
    .object({
        kind: z.literal("link").default("link"),
        orgRole: orgRoleSchema.default("member"),
        teamSlug: z.string().optional(),
        teamRole: teamRoleSchema.optional(),
        expiresInDays: z.number().int().min(1).max(30).default(7),
        /** A custom expiry instead of a preset: within the next 30 days. */
        expiresAt: z.iso.datetime({ offset: true }).optional(),
        maxUses: z.number().int().min(1).max(1000).optional(),
    })
    .refine((v) => !v.teamSlug || !!v.teamRole, { message: "Pick a team role.", path: ["teamRole"] })
    .refine((v) => !v.expiresAt || (Date.parse(v.expiresAt) > Date.now() && Date.parse(v.expiresAt) <= Date.now() + 31 * 24 * 60 * 60 * 1000), {
        message: "Pick an expiry date between tomorrow and 30 days from now.",
        path: ["expiresAt"],
    });

/** Creates an invite. Its 10-character code (also used in the /invite/<code> link) is returned once, in the response. */
export const POST = route<P>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);
    const body = await parseBody(req, schema);

    if (body.orgRole === "admin" && role !== "owner") throw forbidden("Only the owner can invite admins.");

    let team = null;
    if (body.teamSlug) {
        team = await Team.findOne({ org: org._id, slug: body.teamSlug });
        if (!team) throw badRequest("Team not found.");
    }

    const token = await newInviteCode();
    const invite = await Invite.create({
        org: org._id,
        kind: "link",
        tokenHash: sha256(token),
        orgRole: body.orgRole,
        team: team?._id,
        teamRole: team ? body.teamRole : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000),
        maxUses: body.maxUses,
        createdBy: me.id,
    });

    await audit(
        org,
        me,
        "invite.create",
        { type: "invite", id: String(invite._id), name: "invite link" },
        { orgRole: body.orgRole, team: team?.name, teamRole: body.teamRole, expiresInDays: body.expiresAt ? undefined : body.expiresInDays, expiresAt: body.expiresAt, maxUses: body.maxUses },
        req
    );

    await invite.populate("team", "name slug");
    return json({ invite: serialize(invite), token }, 201);
});
