import { NextRequest } from "next/server";
import Invite from "@/models/invite";
import { json, notFound, rateLimit, route } from "@/lib/http";
import { sha256 } from "@/lib/totp";
import { normalizeInviteToken } from "@/lib/invite-code";

/** Public, minimal preview of a link invite so the join page can show where it leads. */
export const GET = route<{ token: string }>(async (req: NextRequest, { params }) => {
    await rateLimit(req);
    const invite: any = await Invite.findOne({ tokenHash: sha256(normalizeInviteToken(decodeURIComponent(params.token))), kind: "link" })
        .populate("org", "name")
        .populate("team", "name")
        .populate("createdBy", "name");
    if (!invite || !invite.org) throw notFound("This invite link is invalid.");

    const status = invite.revokedAt
        ? "revoked"
        : invite.expiresAt.getTime() < Date.now()
          ? "expired"
          : invite.maxUses && invite.uses >= invite.maxUses
            ? "used_up"
            : "active";

    return json({
        invite: {
            org: invite.org.name,
            team: invite.team?.name ?? null,
            orgRole: invite.orgRole,
            teamRole: invite.teamRole ?? null,
            invitedBy: invite.createdBy?.name ?? null,
            expiresAt: invite.expiresAt,
            status,
        },
    });
});
