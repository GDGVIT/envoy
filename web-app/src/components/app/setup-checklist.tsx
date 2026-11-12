"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check, FolderPlus, Plus, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { OrgData } from "./org-context";

type Step = {
    id: string;
    title: string;
    body: string;
    icon: React.ElementType;
    done: boolean;
    action: React.ReactNode;
};

const dismissKey = (slug: string) => `envoy:setup-dismissed:${slug}`;

/**
 * Getting-started checklist for owners and admins: create the org, a team, a project, then invite people.
 * Progress comes from real data. The next unfinished step carries its button. It hides itself once every
 * step is done, and can be dismissed per organization (remembered in this browser).
 */
export function SetupChecklist({
    slug,
    data,
    onCreateTeam,
    onCreateProject,
    dismissible = true,
}: {
    /** False while the checklist is the only content on the page (no teams yet). */
    dismissible?: boolean;
    slug: string;
    data: OrgData;
    onCreateTeam: () => void;
    onCreateProject: (team: { slug: string; name: string }) => void;
}) {
    const { data: invites } = useSWR<{ invites: { status: string }[] }>(`/api/orgs/${slug}/invites`, fetcher);
    const [dismissed, setDismissed] = useState(true); // assume hidden until storage is read, so it never flashes

    useEffect(() => {
        try {
            setDismissed(localStorage.getItem(dismissKey(slug)) === "1");
        } catch {
            setDismissed(false);
        }
    }, [slug]);

    const { org, teams } = data;
    const firstTeam = teams[0];
    const hasProject = teams.some((t) => t.projects.length > 0);
    const invited = org.memberCount > 1 || !!invites?.invites.some((i) => i.status !== "revoked" && i.status !== "expired");

    const steps: Step[] = [
        { id: "org", title: "Create the organization", body: `You created ${org.name}.`, icon: Check, done: true, action: null },
        {
            id: "team",
            title: "Create a team",
            body: "One per group that shares secrets, like Backend or Mobile.",
            icon: Users,
            done: teams.length > 0,
            action: (
                <Button size="sm" onClick={onCreateTeam}>
                    <Plus /> New team
                </Button>
            ),
        },
        {
            id: "project",
            title: "Add a project",
            body: "Each starts with development, staging and production.",
            icon: FolderPlus,
            done: hasProject,
            action: firstTeam && (
                <Button size="sm" onClick={() => onCreateProject({ slug: firstTeam.slug, name: firstTeam.name })}>
                    <Plus /> New project
                </Button>
            ),
        },
        {
            id: "invite",
            title: "Invite your teammates",
            body: "Choose who can edit and who can only view.",
            icon: UserPlus,
            done: invited,
            action: (
                <Button asChild size="sm">
                    <Link href={`/o/${slug}/settings/invites`}>
                        <UserPlus /> Invite people
                    </Link>
                </Button>
            ),
        },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const current = steps.find((s) => !s.done);
    if (!current || (dismissible && dismissed)) return null;

    function dismiss() {
        setDismissed(true);
        try {
            localStorage.setItem(dismissKey(slug), "1");
        } catch {
            /* storage unavailable: hidden for this visit only */
        }
    }

    return (
        <section aria-labelledby="setup-title" className="@container/setup relative mb-10 rounded-lg ring-1 ring-border">
            {/* Layout follows the checklist's own width, not the window's (the sidebar takes part of the window). */}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-8 p-5 @3xl/setup:grid-cols-[minmax(0,260px)_minmax(0,1fr)] @3xl/setup:p-8">
            {dismissible && (
                <Button variant="ghost" size="icon-sm" aria-label="Hide setup checklist" onClick={dismiss} className="absolute right-3 top-3 text-muted-foreground">
                    <X />
                </Button>
            )}

            <div>
                <h2 id="setup-title" className="pr-8 text-lg font-semibold tracking-[-0.015em]">
                    Set up your organization
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {steps.length} steps and your team can pull secrets from <strong className="font-semibold text-foreground">anywhere</strong>.
                </p>
                <div className="mt-6 flex items-center gap-3">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={steps.length}
                        aria-valuenow={doneCount}
                        aria-label="Setup progress"
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                    </div>
                    <span className="text-[12px] tabular-nums text-muted-foreground">
                        {doneCount} of {steps.length}
                    </span>
                </div>
            </div>

            <ol className="@container/steps flex flex-col gap-1 @3xl/setup:pr-8">
                {steps.map((s) => {
                    const isCurrent = s.id === current.id;
                    return (
                        <li key={s.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg px-3 py-3", isCurrent && "bg-muted/60")}>
                            <span
                                className={cn(
                                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                                    s.done ? "bg-primary text-primary-foreground" : isCurrent ? "bg-pastel-mint text-pastel-mint-fg" : "bg-muted text-muted-foreground"
                                )}
                            >
                                {s.done ? <Check className="size-4" /> : <s.icon className="size-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{s.title}</p>
                                <p className="text-[12.5px] text-muted-foreground @lg/steps:truncate">{s.body}</p>
                            </div>
                            {/* The button sits beside the text only when the steps column has room; otherwise it drops below it. */}
                            {isCurrent && s.action && <div className="w-full pl-12 @lg/steps:w-auto @lg/steps:pl-0">{s.action}</div>}
                        </li>
                    );
                })}
            </ol>
            </div>
        </section>
    );
}
