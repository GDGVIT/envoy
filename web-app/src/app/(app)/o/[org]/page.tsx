"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus, Plus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/app-shell";
import { CreateProjectDialog, CreateTeamDialog } from "@/components/app/dialogs";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { ROLE_LABEL, useOrg } from "@/components/app/org-context";
import { LoadError, LoadingPage, LowBackupCodesBanner } from "@/components/app/states";
import { timeAgo } from "@/lib/format";
import { EmptyState, PageHeader, ToneBadge, ToneTile } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { roleTone } from "@/lib/tones";

export default function OrgOverviewPage() {
    const { data, error, slug, isAdmin, mutate } = useOrg();
    const [createTeam, setCreateTeam] = useState(false);
    const [projectFor, setProjectFor] = useState<{ slug: string; name: string } | null>(null);

    if (error) return <LoadError error={error} notFoundTitle="Organization not found" onRetry={() => mutate()} />;
    if (!data) return <LoadingPage />;

    const { org, teams } = data;
    const projectCount = teams.reduce((n, t) => n + t.projects.length, 0);

    return (
        <PageContainer>
            <LowBackupCodesBanner />
            <PageHeader
                title={
                    <span className="flex items-center gap-3">
                        {org.name}
                        <ToneBadge tone={roleTone(org.role)}>{ROLE_LABEL[org.role]}</ToneBadge>
                    </span>
                }
                description={`${teams.length} ${isAdmin ? "" : "of your "}team${teams.length === 1 ? "" : "s"}, ${projectCount} project${projectCount === 1 ? "" : "s"}, ${org.memberCount} member${org.memberCount === 1 ? "" : "s"}.`}
                actions={
                    isAdmin && (
                        <>
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/o/${slug}/settings/invites`}>
                                    <UserPlus /> Invite people
                                </Link>
                            </Button>
                            <Button variant="default" size="sm" onClick={() => setCreateTeam(true)}>
                                <Plus /> New team
                            </Button>
                        </>
                    )
                }
            />

            {isAdmin && slug && (
                <SetupChecklist
                    slug={slug}
                    data={data}
                    dismissible={teams.length > 0}
                    onCreateTeam={() => setCreateTeam(true)}
                    onCreateProject={setProjectFor}
                />
            )}

            {teams.length === 0 ? (
                !isAdmin && (
                    <EmptyState icon={<Users />} title="You're not on a team yet">
                        Ask an owner or admin of {org.name} to add you to a team. Its projects will appear here.
                    </EmptyState>
                )
            ) : (
                <div className="flex flex-col gap-10">
                    {teams.map((team) => (
                        <section key={team.id} aria-labelledby={`team-${team.id}`}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <ToneTile name={team.name} />
                                    <h2 id={`team-${team.id}`} className="truncate text-[15px] font-medium text-foreground">
                                        <Link href={`/o/${slug}/t/${team.slug}`} className="hover:underline hover:underline-offset-4">
                                            {team.name}
                                        </Link>
                                    </h2>
                                    <span className="shrink-0 text-[13px] text-muted-foreground">
                                        {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
                                    </span>
                                    {team.access === "view" && <ToneBadge tone="peach">Read-only</ToneBadge>}
                                </div>
                                {team.access !== "view" && (
                                    <Button variant="ghost" size="sm" onClick={() => setProjectFor({ slug: team.slug, name: team.name })}>
                                        <FolderPlus /> New project
                                    </Button>
                                )}
                            </div>
                            {team.projects.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
                                    No projects in {team.name} yet.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border rounded-lg border border-border">
                                    {team.projects.map((p) => (
                                        <li key={p.id}>
                                            <Link
                                                href={`/o/${slug}/t/${team.slug}/p/${p.slug}`}
                                                className="flex h-11 items-center justify-between gap-4 px-4 hover:bg-muted/40"
                                            >
                                                <span className="truncate font-mono text-[13px] text-foreground">{p.slug}</span>
                                                <span className="shrink-0 text-xs text-muted-foreground">Updated {timeAgo(p.updatedAt)}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}

            <CreateTeamDialog open={createTeam} onOpenChange={setCreateTeam} />
            {projectFor && (
                <CreateProjectDialog
                    open={!!projectFor}
                    onOpenChange={(o) => !o && setProjectFor(null)}
                    teamSlug={projectFor.slug}
                    teamName={projectFor.name}
                />
            )}
        </PageContainer>
    );
}
