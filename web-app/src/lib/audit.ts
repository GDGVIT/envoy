import "server-only";
import { NextRequest } from "next/server";
import AuditLog from "@/models/auditLog";
import { getUserIP } from "@/utils/limiter";
import type { AuthedUser } from "@/lib/auth";

export type AuditAction =
    | "org.create"
    | "org.update"
    | "org.2fa_required"
    | "org.2fa_optional"
    | "org.transfer"
    | "member.join"
    | "member.role_change"
    | "member.remove"
    | "member.leave"
    | "member.2fa_reset"
    | "team.create"
    | "team.update"
    | "team.delete"
    | "team.member_add"
    | "team.member_role_change"
    | "team.member_remove"
    | "project.create"
    | "project.update"
    | "project.delete"
    | "project.access_change"
    | "project.move"
    | "env.create"
    | "env.update"
    | "env.delete"
    | "vars.update"
    | "invite.create"
    | "invite.revoke"
    | "invite.accept";

type Target = { type: string; id?: string; name?: string };

/**
 * Records a write action for the org's audit log. Never pass secret values in `meta`;
 * only key names. Failures are logged and swallowed so they never break the request.
 */
export async function audit(
    org: { _id: unknown } | string,
    actor: Pick<AuthedUser, "id" | "name" | "email"> | null,
    action: AuditAction,
    target?: Target,
    meta?: Record<string, unknown>,
    req?: NextRequest
) {
    try {
        await AuditLog.create({
            org: typeof org === "string" ? org : org._id,
            actor: actor?.id,
            actorName: actor?.name,
            actorEmail: actor?.email,
            action,
            target,
            meta,
            ip: req ? getUserIP(req) : undefined,
        });
    } catch (error) {
        console.error("audit log write failed", error);
    }
}
