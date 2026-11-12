import { NextRequest } from "next/server";
import { z } from "zod";
import Invite from "@/models/invite";
import OrgMembership from "@/models/orgMembership";
import TeamMembership from "@/models/teamMembership";
import Team from "@/models/team";
import User from "@/models/user";
import Organization from "@/models/organization";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { badRequest, conflict, json, notFound, parseBody, rateLimit, route } from "@/lib/http";
import { sha256 } from "@/lib/totp";
import { normalizeInviteToken } from "@/lib/invite-code";

const schema = z.object({ token: z.string().trim().min(10).max(256) });

/** Accepts an invite by its code (or the link that contains it). */
export const POST = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const body = await parseBody(req, schema);
    await rateLimit(req, `invite-accept:${me.id}`);

    // Links only: invites created before links-only (in-app email invites) can't be accepted.
    const invite: any = await Invite.findOne({ tokenHash: sha256(normalizeInviteToken(body.token)), kind: "link" });
    if (!invite) throw notFound("That invite code isn't valid. Check it and try again, or ask an admin for a new one.");

    if (invite.revokedAt) throw badRequest("This invite was revoked.", "invite_revoked");
    if (invite.expiresAt.getTime() < Date.now()) throw badRequest("This invite has expired. Ask for a new one.", "invite_expired");
    if (invite.maxUses && invite.uses >= invite.maxUses) throw badRequest("This invite has already been used.", "invite_used");

    const existing = await OrgMembership.findOne({ org: invite.org, user: me.id });
    const team = invite.team ? await Team.findOne({ _id: invite.team, org: invite.org }) : null;

    if (existing && (!team || (await TeamMembership.exists({ team: team._id, user: me.id })))) {
        throw conflict("You're already a member of this organization.", "already_member");
    }

    // Atomically claim a use (compare-and-swap on the use count we just checked), so a link
    // with maxUses can't be over-redeemed by concurrent requests.
    const claimed = await Invite.findOneAndUpdate(
        { _id: invite._id, revokedAt: null, uses: invite.uses },
        { $inc: { uses: 1 }, $addToSet: { acceptedBy: me.id } },
        { new: true }
    );
    if (!claimed) throw badRequest("This invite has already been used.", "invite_used");

    if (!existing) {
        await OrgMembership.create({ org: invite.org, user: me.id, role: invite.orgRole || "member" });
    }
    if (team) {
        await TeamMembership.updateOne(
            { team: team._id, user: me.id },
            { $setOnInsert: { team: team._id, org: invite.org, user: me.id, role: invite.teamRole || "viewer" } },
            { upsert: true }
        );
    }

    const actor = { id: me.id, name: me.name, email: me.email };
    await audit(String(invite.org), actor, existing ? "invite.accept" : "member.join", { type: "user", id: me.id, name: me.email }, {
        via: invite.kind,
        orgRole: existing ? undefined : invite.orgRole,
        team: team?.name,
        teamRole: team ? invite.teamRole : undefined,
    }, req);

    const org = await Organization.findById(invite.org).select("slug name");
    await User.updateOne({ _id: me.id }, { lastOrgSlug: org?.slug });

    return json({ org: { slug: org?.slug, name: org?.name }, team: team ? { slug: team.slug, name: team.name } : null });
});
