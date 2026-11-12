"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { FormField } from "@/components/common";
import { api } from "@/lib/api-client";
import { useOrg } from "./org-context";

/**
 * Owners and admins: moves a project (with all its environments and variables) to another team.
 * Resolves with the new team's slug so the page can follow the project to its new URL.
 */
export function MoveProjectDialog({
    open,
    onOpenChange,
    projectUrl,
    projectName,
    projectSlug,
    teamSlug,
    restricted,
    onMoved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The project's API path, e.g. /api/orgs/acme/teams/backend/projects/api. */
    projectUrl: string;
    projectName: string;
    projectSlug: string;
    teamSlug: string;
    restricted: boolean;
    onMoved: (newTeamSlug: string, newTeamName: string) => void;
}) {
    const { data, slug } = useOrg();
    const teams = (data?.teams ?? []).filter((t) => t.slug !== teamSlug);
    const current = data?.teams.find((t) => t.slug === teamSlug);
    const [target, setTarget] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chosen = teams.find((t) => t.slug === target);
    const clash = !!chosen?.projects.some((p) => p.slug === projectSlug);

    useEffect(() => {
        if (open) {
            setTarget("");
            setError(null);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Move {projectName}</DialogTitle>
                    <DialogDescription>
                        Its environments and variables move with it. Access then follows the new team&apos;s{" "}
                        <strong className="font-semibold text-foreground">editors and viewers</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!chosen || clash) return;
                        setBusy(true);
                        setError(null);
                        try {
                            const res = await api<{ team: { slug: string; name: string } }>(`${projectUrl}/move`, { body: { teamSlug: chosen.slug } });
                            onMoved(res.team.slug, res.team.name);
                            onOpenChange(false);
                        } catch (err: any) {
                            setError(err.message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <FormField
                        label="Move to"
                        htmlFor="move-team"
                        error={clash ? `${chosen?.name} already has a project at /${projectSlug}. Rename one of them first.` : error}
                    >
                        <Select value={target} onValueChange={setTarget} disabled={!teams.length}>
                            <SelectTrigger id="move-team" className="w-full">
                                <SelectValue placeholder={teams.length ? "Choose a team" : "There are no other teams"} />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map((t) => (
                                    <SelectItem key={t.id} value={t.slug}>
                                        {t.name}
                                        <span className="text-muted-foreground">
                                            {" "}
                                            · {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    <div className="flex gap-2.5 rounded-lg bg-muted/50 p-3 text-[13px] leading-relaxed text-muted-foreground">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-foreground" />
                        <div className="flex flex-col gap-1.5">
                            <p>
                                CLI commands and API URLs include the team, so{" "}
                                <code className="font-mono text-[12px] text-foreground">
                                    /{slug}/{teamSlug}/{projectSlug}
                                </code>{" "}
                                becomes{" "}
                                <code className="font-mono text-[12px] text-foreground">
                                    /{slug}/{chosen?.slug ?? "…"}/{projectSlug}
                                </code>
                                . <strong className="font-semibold text-foreground">Update scripts and CI</strong> that use the old path.
                            </p>
                            <p>
                                {restricted
                                    ? `It's limited to selected people: only those who are also on ${chosen?.name ?? "the new team"} keep access.`
                                    : `People on ${current?.name ?? "this team"} who aren't on ${chosen?.name ?? "the new team"} lose access.`}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogCancel onClick={() => onOpenChange(false)} />
                        <DialogSubmit loading={busy} disabled={!chosen || clash}>
                            Move project
                        </DialogSubmit>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
