"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Crown, MoreHorizontal, ShieldCheck, ShieldOff, Trash2, UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, useOrg } from "@/components/app/org-context";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api-client";
import { usePaginated } from "@/lib/use-paginated";
import { formatDate, timeAgo } from "@/lib/format";
import { LoadMore, UserAvatar, SearchInput, ToneBadge } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleTone, TONE_BADGE } from "@/lib/tones";
import { cn } from "@/lib/utils";

type Member = {
    userId: string;
    name: string;
    email: string;
    image: string | null;
    provider: "credentials" | "google";
    totpEnabled: boolean;
    role: "owner" | "admin" | "member";
    joinedAt: string;
    teams: { name: string; slug: string; role: string }[];
    isMe: boolean;
};

type Pending = { kind: "remove" | "transfer" | "reset2fa"; member: Member } | null;

const ROLE_CARDS: { role: "owner" | "admin" | "member"; icon: React.ElementType; summary: string; can: string[] }[] = [
    {
        role: "owner",
        icon: Crown,
        summary: "One per organization, with full control.",
        can: ["Everything an admin can do", "Delete the organization", "Transfer ownership", "Reset a member's two-factor"],
    },
    {
        role: "admin",
        icon: ShieldCheck,
        summary: "Runs the organization day to day.",
        can: ["Create teams and add people to them", "Invite and remove members", "Edit every project", "Read the audit log"],
    },
    {
        role: "member",
        icon: UserRound,
        summary: "Works inside the teams they're added to.",
        can: ["Sees only their own teams", "Editor or viewer per team", "Uses API tokens with the same access"],
    },
];

export default function MembersPage() {
    const { slug, isAdmin, isOwner, mutate: mutateOrg } = useOrg();
    const { data: security } = useSWR<{ require2fa: boolean }>(slug ? `/api/orgs/${slug}/security` : null, fetcher);
    const require2fa = !!security?.require2fa;
    const key = `/api/orgs/${slug}/members`;
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [pending, setPending] = useState<Pending>(null);

    // Search runs on the server (it covers every member, not just loaded pages); wait for typing to pause.
    useEffect(() => {
        const t = setTimeout(() => setDebounced(query.trim()), 250);
        return () => clearTimeout(t);
    }, [query]);

    const list = usePaginated<Member>(slug ? (debounced ? `${key}?q=${encodeURIComponent(debounced)}` : key) : null, "members");
    const members = list.items;
    const data = list.isLoading ? undefined : list.first;
    const mutate = list.mutate;

    async function changeRole(m: Member, role: string) {
        try {
            await api(`${key}/${m.userId}`, { method: "PATCH", body: { role } });
            toast.success(`${m.name} is now ${role === "admin" ? "an admin" : "a member"}`);
            mutate();
            mutateOrg();
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    // Admins can change members; only the owner can change admins.
    const canManage = (m: Member) => !m.isMe && m.role !== "owner" && (isOwner || (isAdmin && m.role === "member"));

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <SearchInput size="sm" value={query} onChange={setQuery} placeholder="Search by name or email" label="Search members" />
                {isAdmin && (
                    <Button asChild variant="default" size="sm">
                        <Link href={`/o/${slug}/settings/invites`}>
                            <UserPlus /> Invite people
                        </Link>
                    </Button>
                )}
            </div>

            {!data ? (
                <div className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                    ))}
                </div>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {members.map((m) => (
                        <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                            <UserAvatar name={m.name} src={m.image} className="size-8" />
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 truncate text-sm text-foreground">
                                    {m.name}
                                    {m.isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {m.email}
                                    {m.teams.length > 0 && <span className="hidden sm:inline">, {m.teams.map((t) => t.name).join(", ")}</span>}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {!m.totpEnabled &&
                                    (require2fa ? (
                                        <ToneBadge tone="rose" className="hidden sm:inline-flex">
                                            Needs 2FA
                                        </ToneBadge>
                                    ) : (
                                        <ToneBadge tone="neutral" className="hidden sm:inline-flex">
                                            No 2FA
                                        </ToneBadge>
                                    ))}
                                <span className="hidden whitespace-nowrap text-right text-xs text-muted-foreground md:inline" title={formatDate(m.joinedAt)}>
                                    Joined {timeAgo(m.joinedAt)}
                                </span>
                                {canManage(m) ? (
                                    <Select value={m.role} onValueChange={(v) => changeRole(m, v)}>
                                        <SelectTrigger size="sm" aria-label={`Role for ${m.name}`} className="w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                            <SelectItem value="member">Member</SelectItem>
                                            {(isOwner || m.role === "admin") && <SelectItem value="admin">Admin</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <ToneBadge tone={roleTone(m.role)} className="w-fit">
                                        {ROLE_LABEL[m.role]}
                                    </ToneBadge>
                                )}
                                {(canManage(m) || (isOwner && !m.isMe)) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${m.name}`}>
                                                <MoreHorizontal />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {isOwner && m.role === "admin" && (
                                                <DropdownMenuItem onSelect={() => setPending({ kind: "transfer", member: m })}>
                                                    <Crown /> Transfer ownership
                                                </DropdownMenuItem>
                                            )}
                                            {isOwner && m.totpEnabled && (
                                                <DropdownMenuItem onSelect={() => setPending({ kind: "reset2fa", member: m })}>
                                                    <ShieldOff /> Reset two-factor authentication
                                                </DropdownMenuItem>
                                            )}
                                            {canManage(m) && (
                                                <DropdownMenuItem variant="destructive" onSelect={() => setPending({ kind: "remove", member: m })}>
                                                    <Trash2 /> Remove from organization
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </li>
                    ))}
                    {members.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">No members match &ldquo;{query}&rdquo;.</li>}
                </ul>
            )}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />

            <section aria-labelledby="roles-title" className="mt-10">
                <h2 id="roles-title" className="mb-3 text-[15px] font-medium">Roles</h2>
                <ul className="grid gap-3 md:grid-cols-3">
                    {ROLE_CARDS.map((r) => (
                        <li key={r.role} className="flex flex-col gap-3 rounded-lg p-4 ring-1 ring-border">
                            <div className="flex items-center gap-2.5">
                                <span className={cn("flex size-8 items-center justify-center rounded-md", TONE_BADGE[roleTone(r.role)])}>
                                    <r.icon className="size-4" />
                                </span>
                                <p className="text-sm font-medium">{ROLE_LABEL[r.role]}</p>
                            </div>
                            <p className="text-[13px] leading-relaxed text-muted-foreground">{r.summary}</p>
                            <ul className="mt-auto flex flex-col gap-1.5 text-[12.5px] text-muted-foreground">
                                {r.can.map((c) => (
                                    <li key={c} className="flex items-start gap-2">
                                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            </section>

            <ConfirmDialog
                open={pending?.kind === "remove"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Remove ${pending?.member.name}?`}
                description="They'll lose access to every team and project in this organization right away, including through their API tokens."
                confirmText={pending?.member.email}
                actionLabel="Remove member"
                onConfirm={async () => {
                    try {
                        await api(`${key}/${pending!.member.userId}`, { method: "DELETE" });
                        toast.success(`Removed ${pending!.member.name}`);
                        mutate();
                        mutateOrg();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
            <ConfirmDialog
                open={pending?.kind === "transfer"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Make ${pending?.member.name} the owner?`}
                description="You'll become an admin. Only the new owner can delete the organization or transfer ownership again."
                actionLabel="Transfer ownership"
                danger={false}
                onConfirm={async () => {
                    try {
                        await api(`/api/orgs/${slug}/transfer`, { body: { userId: pending!.member.userId } });
                        toast.success("Ownership transferred");
                        mutate();
                        mutateOrg();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
            <ConfirmDialog
                open={pending?.kind === "reset2fa"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Reset 2FA for ${pending?.member.name}?`}
                description={
                    <>
                        Use this only if they&apos;ve lost their authenticator and backup codes, and you&apos;ve confirmed
                        it&apos;s really them. They&apos;ll be signed out everywhere and must set up 2FA again after signing in
                        with their password or Google. This is recorded in the audit log.
                    </>
                }
                confirmText={pending?.member.email}
                actionLabel="Reset 2FA"
                onConfirm={async () => {
                    try {
                        const res = await api<{ message: string }>(`${key}/${pending!.member.userId}/reset-2fa`, { method: "POST" });
                        toast.success(res.message);
                        mutate();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
        </div>
    );
}

