"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Lock, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToneBadge } from "@/components/common";
import { ROLE_LABEL } from "@/components/app/org-context";
import { api, fetcher } from "@/lib/api-client";
import { roleTone } from "@/lib/tones";
import { PeoplePicker } from "@/components/app/people-picker";
import { cn } from "@/lib/utils";

export const RESTRICTED_LABEL = "Only selected people";

/** Lock shown next to projects set to "Only selected people". */
export function RestrictedLock({ className }: { className?: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span role="img" aria-label={RESTRICTED_LABEL} className={cn("inline-flex shrink-0 items-center text-muted-foreground", className)}>
                    <Lock className="size-3.5" />
                </span>
            </TooltipTrigger>
            <TooltipContent>{RESTRICTED_LABEL}</TooltipContent>
        </Tooltip>
    );
}

type AccessMember = {
    userId: string;
    name: string;
    email: string;
    image: string | null;
    role: "editor" | "viewer";
    allowed: boolean;
    /** Org owners and admins open every project, whatever this setting says. */
    alwaysAllowed: boolean;
};
type AccessData = { restricted: boolean; members: AccessMember[] };

const strong = (s: string) => <strong className="font-semibold text-foreground">{s}</strong>;

function Option({
    icon: Icon,
    title,
    checked,
    onSelect,
    children,
}: {
    icon: React.ElementType;
    title: string;
    checked: boolean;
    onSelect: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onSelect}
            className={cn(
                "flex w-full items-start gap-3 rounded-lg border bg-background p-3.5 text-left transition-colors outline-none",
                "hover:bg-muted/40 focus-visible:ring-4 focus-visible:ring-primary/25",
                checked ? "border-primary/60 ring-1 ring-primary/40" : "hover:border-foreground/25"
            )}
        >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{children}</span>
            </span>
            <span
                aria-hidden
                className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    checked ? "border-primary" : "border-foreground/25"
                )}
            >
                {checked && <span className="size-2 rounded-full bg-primary" />}
            </span>
        </button>
    );
}

function AccessForm({
    data,
    url,
    teamName,
    onDone,
    onCancel,
}: {
    data: AccessData;
    url: string;
    teamName: string;
    onDone: () => void;
    onCancel: () => void;
}) {
    const [restricted, setRestricted] = useState(data.restricted);
    const [selected, setSelected] = useState(() => new Set(data.members.filter((m) => m.allowed).map((m) => String(m.userId))));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pickable = data.members.filter((m) => !m.alwaysAllowed);
    const chosen = pickable.filter((m) => selected.has(String(m.userId))).length;

    const toggle = (id: string, on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                    const userIds = restricted ? pickable.map((m) => String(m.userId)).filter((id) => selected.has(id)) : [];
                    await api(url, { method: "PUT", body: { restricted, userIds } });
                    toast.success(restricted ? "Only selected people can open this project" : "Everyone on the team can open this project");
                    onDone();
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setBusy(false);
                }
            }}
        >
            <div role="radiogroup" aria-label="Who can open this project" className="flex flex-col gap-2">
                <Option icon={Users} title="Everyone on the team" checked={!restricted} onSelect={() => setRestricted(false)}>
                    Every editor and viewer on {teamName}, <strong className="font-semibold text-foreground">including people added later</strong>.
                </Option>
                <Option icon={Lock} title={RESTRICTED_LABEL} checked={restricted} onSelect={() => setRestricted(true)}>
                    Only the team members you pick. People added to the team later{" "}
                    <strong className="font-semibold text-foreground">don&apos;t get access</strong> until you add them here.
                </Option>
            </div>

            {restricted && (
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[13px] font-medium">People on {teamName}</p>
                        {pickable.length > 0 && (
                            <p className="text-xs tabular-nums text-muted-foreground">
                                {chosen} of {pickable.length} selected
                            </p>
                        )}
                    </div>
                    <PeoplePicker
                        mode="multi"
                        people={data.members.map((m) => ({
                            id: String(m.userId),
                            name: m.name,
                            email: m.email,
                            image: m.image,
                            locked: m.alwaysAllowed,
                            note: m.alwaysAllowed ? "admin, always has access" : undefined,
                            badge: <ToneBadge tone={roleTone(m.role)}>{ROLE_LABEL[m.role]}</ToneBadge>,
                        }))}
                        isChecked={(id) => data.members.some((m) => String(m.userId) === id && m.alwaysAllowed) || selected.has(id)}
                        onPick={(id) => toggle(id, !selected.has(id))}
                        emptyText="No one is on this team yet. Only owners and admins will be able to open this project."
                    />
                    {pickable.length > 0 && chosen === 0 && (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            No one selected. Only owners and admins will be able to open this project.
                        </p>
                    )}
                </div>
            )}

            {error && <p className="text-[13px] text-destructive">{error}</p>}

            <DialogFooter>
                <DialogCancel onClick={onCancel} />
                <DialogSubmit loading={busy}>Save access</DialogSubmit>
            </DialogFooter>
        </form>
    );
}

/** Owners and admins: choose between everyone on the team and only selected team members. */
export function ProjectAccessDialog({
    open,
    onOpenChange,
    projectUrl,
    projectName,
    teamName,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The project's API path, e.g. /api/orgs/acme/teams/backend/projects/api. */
    projectUrl: string;
    projectName: string;
    teamName: string;
    onSaved: () => void;
}) {
    const url = `${projectUrl}/access`;
    const { data, error } = useSWR<AccessData>(open ? url : null, fetcher, { revalidateOnFocus: false });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage access</DialogTitle>
                    <DialogDescription>
                        Choose who on {strong(teamName)} can open {strong(projectName)}. Owners and admins{" "}
                        <strong className="font-semibold text-foreground">can always open every project</strong>.
                    </DialogDescription>
                </DialogHeader>
                {data ? (
                    <AccessForm
                        data={data}
                        url={url}
                        teamName={teamName}
                        onCancel={() => onOpenChange(false)}
                        onDone={() => {
                            onSaved();
                            onOpenChange(false);
                        }}
                    />
                ) : (
                    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
                        {error ? (
                            <p className="text-[13px] text-destructive">{(error as Error).message}</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-[74px] rounded-lg" />
                                <Skeleton className="h-[74px] rounded-lg" />
                            </div>
                        )}
                        <DialogFooter>
                            <DialogCancel onClick={() => onOpenChange(false)} />
                            <DialogSubmit disabled>Save access</DialogSubmit>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
