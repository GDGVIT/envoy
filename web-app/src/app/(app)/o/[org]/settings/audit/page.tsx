"use client";

import { useEffect, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/components/app/org-context";
import { NotFoundState } from "@/components/app/states";
import { fetcher } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDate, timeAgo } from "@/lib/format";
import { UserAvatar, EmptyState, SearchInput, ToneDot } from "@/components/common";
import type { Tone } from "@/lib/tones";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Entry = {
    id: string;
    action: string;
    actor: { id: string; name: string; email: string } | null;
    target: { type: string; id?: string; name?: string } | null;
    meta: Record<string, any> | null;
    ip: string | null;
    createdAt: string;
};
type Page = { entries: Entry[]; nextCursor: string | null };

const ACTIONS: Record<string, string> = {
    "org.create": "created the organization",
    "org.update": "updated organization settings",
    "org.2fa_required": "made two-factor authentication required in",
    "org.2fa_optional": "made two-factor authentication optional in",
    "org.transfer": "transferred ownership to",
    "member.join": "joined the organization",
    "member.role_change": "changed the role of",
    "member.remove": "removed",
    "member.leave": "left the organization",
    "member.2fa_reset": "reset two-factor authentication for",
    "team.create": "created team",
    "team.update": "updated team",
    "team.delete": "deleted team",
    "team.member_add": "added a member to",
    "team.member_role_change": "changed team access in",
    "team.member_remove": "removed a member from",
    "project.create": "created project",
    "project.update": "updated project",
    "project.delete": "deleted project",
    "project.access_change": "changed who can open",
    "project.move": "moved project",
    "env.create": "created environment",
    "env.update": "renamed environment",
    "env.delete": "deleted environment",
    "vars.update": "changed variables in",
    "invite.create": "invited",
    "invite.revoke": "revoked the invitation for",
    "invite.accept": "accepted an invitation to",
};

const CATEGORY_TONE: Record<string, Tone> = {
    vars: "mint",
    member: "sky",
    team: "lavender",
    project: "peach",
    env: "lemon",
    invite: "rose",
    org: "lavender",
};

const FILTERS = [
    { value: "", label: "All activity" },
    { value: "vars.", label: "Variable changes" },
    { value: "member.", label: "Members" },
    { value: "team.", label: "Teams" },
    { value: "project.", label: "Projects" },
    { value: "env.", label: "Environments" },
    { value: "invite.", label: "Invitations" },
    { value: "org.", label: "Organization" },
];

function summarize(e: Entry) {
    const m = e.meta ?? {};
    if (e.action === "vars.update") {
        const parts = [
            m.added?.length && `${m.added.length} added`,
            m.changed?.length && `${m.changed.length} changed`,
            m.removed?.length && `${m.removed.length} removed`,
        ].filter(Boolean);
        return parts.join(", ");
    }
    if (e.action === "member.role_change" || e.action === "team.member_role_change") {
        return `${m.user ? `${m.user}: ` : ""}${m.from} to ${m.to}`;
    }
    if (e.action === "team.member_add") return `${m.user} as ${m.role}`;
    if (e.action === "team.member_remove") return m.user;
    if (e.action === "member.join") return [m.orgRole, m.team && `${m.teamRole} on ${m.team}`].filter(Boolean).join(", ");
    return null;
}

function KeyList({ label, keys }: { label: string; keys?: string[] }) {
    if (!keys?.length) return null;
    return (
        <div>
            <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
            <dd className="flex flex-wrap gap-1">
                {keys.map((k) => (
                    <code key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                        {k}
                    </code>
                ))}
            </dd>
        </div>
    );
}

export default function AuditPage() {
    const { slug, isAdmin } = useOrg();
    const [action, setAction] = useState("");
    const [q, setQ] = useState("");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setQuery(q), 300);
        return () => clearTimeout(t);
    }, [q]);

    const getKey = (index: number, prev: Page | null) => {
        if (!slug || !isAdmin || (prev && !prev.nextCursor)) return null;
        const p = new URLSearchParams();
        if (action) p.set("action", action);
        if (query) p.set("q", query);
        if (prev?.nextCursor) p.set("cursor", prev.nextCursor);
        return `/api/orgs/${slug}/audit?${p}`;
    };
    const { data, size, setSize, isValidating } = useSWRInfinite<Page>(getKey, fetcher);

    if (!isAdmin) return <NotFoundState title="Only owners and admins can view the audit log" />;

    const entries = data?.flatMap((p) => p.entries) ?? [];
    const hasMore = !!data?.[data.length - 1]?.nextCursor;

    return (
        <div>
            <p className="mb-5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                Every change to members, teams, projects, environments and variables. Variable entries record which keys
                changed, never their values.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
                <Select value={action || "all"} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
                    <SelectTrigger aria-label="Filter by activity" className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {FILTERS.map((f) => (
                            <SelectItem key={f.value || "all"} value={f.value || "all"}>
                                {f.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <SearchInput value={q} onChange={setQ} placeholder="Search by person or resource" label="Search audit log" />
            </div>

            {!data ? (
                <div className="flex flex-col gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : entries.length === 0 ? (
                <EmptyState title="No activity found">{action || query ? "Try a different filter." : "Changes in this organization will be listed here."}</EmptyState>
            ) : (
                <ol className="divide-y rounded-lg border">
                    {entries.map((e) => {
                        const expanded = open === e.id;
                        const detail = summarize(e);
                        return (
                            <Collapsible asChild key={e.id} open={expanded} onOpenChange={(o) => setOpen(o ? e.id : null)}>
                            <li>
                                <CollapsibleTrigger className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
                                    <span className="relative mt-0.5">
                                        <UserAvatar name={e.actor?.name} />
                                        <ToneDot
                                            tone={CATEGORY_TONE[e.action.split(".")[0]] ?? "neutral"}
                                            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
                                        />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm leading-relaxed text-foreground">
                                            <span className="font-medium text-foreground">{e.actor?.name ?? "System"}</span>{" "}
                                            {ACTIONS[e.action] ?? e.action}{" "}
                                            {e.target?.name && e.action !== "member.join" && e.action !== "member.leave" && (
                                                <span className={cn("text-foreground", (e.target.type === "environment" || e.target.type === "project") && "font-mono text-[13px]")}>
                                                    {e.target.name}
                                                </span>
                                            )}
                                        </p>
                                        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
                                    </div>
                                    <time dateTime={e.createdAt} title={formatDate(e.createdAt)} className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                                        {timeAgo(e.createdAt)}
                                    </time>
                                    <ChevronRight className={cn("mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <dl className="grid gap-3 border-t border-border bg-muted/40 px-4 py-4 pl-[52px] text-[13px] sm:grid-cols-2">
                                        <div>
                                            <dt className="mb-1 text-xs text-muted-foreground">When</dt>
                                            <dd className="text-foreground">{formatDate(e.createdAt)}</dd>
                                        </div>
                                        <div>
                                            <dt className="mb-1 text-xs text-muted-foreground">Who</dt>
                                            <dd className="text-foreground">
                                                {e.actor?.email ?? "Unknown"}
                                                {e.ip && <span className="text-muted-foreground"> from {e.ip}</span>}
                                            </dd>
                                        </div>
                                        <KeyList label="Added keys" keys={e.meta?.added} />
                                        <KeyList label="Changed keys" keys={e.meta?.changed} />
                                        <KeyList label="Removed keys" keys={e.meta?.removed} />
                                        {e.action !== "vars.update" && e.meta && (
                                            <div className="sm:col-span-2">
                                                <dt className="mb-1 text-xs text-muted-foreground">Details</dt>
                                                <dd>
                                                    <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[12px] text-foreground">
                                                        {JSON.stringify(e.meta, null, 2)}
                                                    </pre>
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </CollapsibleContent>
                            </li>
                            </Collapsible>
                        );
                    })}
                </ol>
            )}

            {hasMore && (
                <div className="mt-4 flex justify-center">
                    <Button variant="outline" size="sm" loading={isValidating} onClick={() => setSize(size + 1)}>
                        Load older activity
                    </Button>
                </div>
            )}
        </div>
    );
}
