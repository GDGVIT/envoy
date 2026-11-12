import "server-only";
import Organization from "@/models/organization";
import OrgMembership, { OrgRole } from "@/models/orgMembership";
import Team from "@/models/team";
import TeamMembership, { TeamRole } from "@/models/teamMembership";
import Project from "@/models/project";
import Environment from "@/models/environment";
import { trusted } from "mongoose";
import { forbidden, notFound } from "@/lib/http";
import type { AuthedUser } from "@/lib/auth";

/** manage = org owner/admin, edit = team editor, view = team viewer. */
export type Access = "manage" | "edit" | "view";

export const isOrgAdmin = (role: OrgRole) => role === "owner" || role === "admin";

export function assertOrgAdmin(role: OrgRole) {
    if (!isOrgAdmin(role)) throw forbidden("Only organization owners and admins can do that.");
}

export function assertOrgOwner(role: OrgRole) {
    if (role !== "owner") throw forbidden("Only the organization owner can do that.");
}

export function assertCanEdit(access: Access) {
    if (access === "view") throw forbidden("You have read-only access to this project.", "read_only");
}

/** Whether the org requires two-factor. Orgs from before the setting existed have none stored: they require it. */
export const requires2fa = (org: { require2fa?: boolean | null }) => org.require2fa !== false;

export async function loadOrg(slug: string, user: AuthedUser, opts: { skip2fa?: boolean } = {}) {
    const org = await Organization.findOne({ slug: String(slug).toLowerCase() });
    if (!org) throw notFound("Organization not found.");
    const membership = await OrgMembership.findOne({ org: org._id, user: user.id });
    // 404 rather than 403 so non-members can't probe which orgs exist.
    if (!membership) throw notFound("Organization not found.");
    // Members get in only after the second step; `skip2fa` is for leaving the org, which shouldn't need it.
    if (!opts.skip2fa && requires2fa(org) && !user.mfa) {
        throw forbidden(
            user.mfaEnrolled
                ? `${org.name} requires two-factor authentication. Sign in again and confirm with your passkey or code.`
                : `${org.name} requires two-factor authentication. Add a passkey or an authenticator app to continue.`,
            "org_requires_2fa"
        );
    }
    return { org, role: membership.role as OrgRole, membership };
}

export type OrgCtx = Awaited<ReturnType<typeof loadOrg>>;

export async function loadTeam(ctx: OrgCtx, teamSlug: string, user: AuthedUser) {
    const team = await Team.findOne({ org: ctx.org._id, slug: String(teamSlug).toLowerCase() });
    if (!team) throw notFound("Team not found.");
    const tm = await TeamMembership.findOne({ team: team._id, user: user.id });
    const teamRole = (tm?.role as TeamRole | undefined) ?? null;

    let access: Access | null = null;
    if (isOrgAdmin(ctx.role)) access = "manage";
    else if (teamRole === "editor") access = "edit";
    else if (teamRole === "viewer") access = "view";

    if (!access) throw notFound("Team not found.");
    return { ...ctx, team, teamRole, access, userId: String(user.id) };
}

export type TeamCtx = Awaited<ReturnType<typeof loadTeam>>;

export async function loadProject(ctx: TeamCtx, projectSlug: string) {
    const project = await Project.findOne({ team: ctx.team._id, slug: String(projectSlug).toLowerCase() });
    // A restricted project the caller isn't allowed into is a 404 too, so hidden projects can't be probed.
    if (!project || !canSeeProject(project, ctx.role, ctx.userId)) throw notFound("Project not found.");
    return { ...ctx, project };
}

export type ProjectCtx = Awaited<ReturnType<typeof loadProject>>;

export async function loadEnvironment(ctx: ProjectCtx, envSlug: string) {
    const environment = await Environment.findOne({ project: ctx.project._id, slug: String(envSlug).toLowerCase() });
    if (!environment) throw notFound("Environment not found.");
    return { ...ctx, environment };
}

type ProjectAccessFields = { restricted?: boolean | null; allowedUsers?: unknown[] | null };

/**
 * Whether the user may see a project. Owners and admins see every project; a team member sees a
 * project restricted to "Only selected people" only when they're on its allowlist.
 */
export function canSeeProject(project: ProjectAccessFields, role: OrgRole, userId: string) {
    if (isOrgAdmin(role) || !project.restricted) return true;
    return (project.allowedUsers ?? []).some((u) => String(u) === String(userId));
}

/**
 * Project query filter for what the user may see; merge it into a `Project.find`/`countDocuments` filter.
 * Uses `$nor`, so it combines with the `$or` that pagination cursors add.
 */
export function visibleProjectsFilter(role: OrgRole, userId: string): Record<string, unknown> {
    if (isOrgAdmin(role)) return {};
    return { $nor: [{ restricted: true, allowedUsers: trusted({ $ne: userId }) }] };
}

/** Team ids in `org` visible to the user: all of them for owner/admin, otherwise their memberships. */
export async function visibleTeamIds(orgId: unknown, role: OrgRole, userId: string) {
    if (isOrgAdmin(role)) {
        const teams = await Team.find({ org: orgId }).select("_id");
        return teams.map((t) => t._id);
    }
    const memberships = await TeamMembership.find({ org: orgId, user: userId }).select("team");
    return memberships.map((m) => m.team);
}
