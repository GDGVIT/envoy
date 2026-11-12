"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Mail, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText, EmptyState, FormField, LoadMore } from "@/components/common";
import { formatInviteCode } from "@/lib/invite-code";
import { ExpiryField, customExpiryISO, type Expiry } from "@/components/expiry-field";
import { ROLE_LABEL, useOrg } from "@/components/app/org-context";
import { NotFoundState } from "@/components/app/states";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api-client";
import { usePaginated } from "@/lib/use-paginated";
import { formatDate, timeAgo } from "@/lib/format";

type Invite = {
    id: string;
    kind: "email" | "link";
    email: string | null;
    orgRole: "admin" | "member";
    team: { name: string; slug: string } | null;
    teamRole: "editor" | "viewer" | null;
    expiresAt: string;
    maxUses: number | null;
    uses: number;
    createdBy: string | null;
    createdAt: string;
    status: "active" | "revoked" | "expired" | "accepted" | "used_up";
};

const STATUS_LABEL: Record<Invite["status"], string> = {
    active: "Active",
    revoked: "Revoked",
    expired: "Expired",
    accepted: "Accepted",
    used_up: "Used up",
};

const NO_TEAM = "__none";

export default function InvitesPage() {
    const { slug, data: orgData, isAdmin, isOwner } = useOrg();
    const key = `/api/orgs/${slug}/invites`;
    const list = usePaginated<Invite>(isAdmin ? key : null, "invites");
    const data = list.isLoading ? undefined : list.first;
    const mutate = list.mutate;

    const [orgRole, setOrgRole] = useState<"member" | "admin">("member");
    const [teamSlug, setTeamSlug] = useState(NO_TEAM);
    const [teamRole, setTeamRole] = useState<"viewer" | "editor">("viewer");
    const [expiry, setExpiry] = useState<Expiry>({ preset: "7", date: "" });
    const [maxUses, setMaxUses] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [revoking, setRevoking] = useState<Invite | null>(null);

    if (!isAdmin) return <NotFoundState title="Only owners and admins can manage invitations" />;

    const teams = orgData?.teams ?? [];
    const invites = list.items.filter((i) => showAll || i.status === "active");
    const hasTeam = teamSlug !== NO_TEAM;

    async function create(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setCreatedCode(null);
        try {
            const res = await api<{ token?: string }>(key, {
                body: {
                    orgRole,
                    teamSlug: hasTeam ? teamSlug : undefined,
                    teamRole: hasTeam ? teamRole : undefined,
                    ...(expiry.preset === "custom" ? { expiresAt: customExpiryISO(expiry.date) } : { expiresInDays: Number(expiry.preset) }),
                    maxUses: maxUses ? Number(maxUses) : undefined,
                },
            });
            if (res.token) setCreatedCode(res.token);
            mutate();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <section>
                <h2 className="text-[15px] font-medium">Create an invite</h2>
                <p className="mb-5 mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    You get a <strong className="font-semibold text-foreground">10-character code</strong> to share, plus a link that
                    contains it. Send it <strong className="font-semibold text-foreground">privately</strong>: anyone who has it can join
                    until it <strong className="font-semibold text-foreground">expires or runs out of uses</strong>.
                </p>

                <form onSubmit={create} className="flex flex-col gap-5">
                    <FormField label="Organization role" htmlFor="invite-role" hint={!isOwner ? "Only the owner can invite admins." : undefined}>
                        <Select value={orgRole} onValueChange={(v) => setOrgRole(v as "member" | "admin")}>
                            <SelectTrigger id="invite-role" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Add to team" htmlFor="invite-team">
                            <Select value={teamSlug} onValueChange={setTeamSlug}>
                                <SelectTrigger id="invite-team" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_TEAM}>No team</SelectItem>
                                    {teams.map((t) => (
                                        <SelectItem key={t.id} value={t.slug}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                        <FormField label="Team access" htmlFor="invite-team-role">
                            <Select value={teamRole} onValueChange={(v) => setTeamRole(v as "viewer" | "editor")} disabled={!hasTeam}>
                                <SelectTrigger id="invite-team-role" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <ExpiryField
                            id="invite-days"
                            label="Expires after"
                            value={expiry}
                            onChange={setExpiry}
                            maxDays={30}
                            presets={[1, 3, 7, 14, 30].map((d) => ({ value: String(d), label: `${d} day${d === 1 ? "" : "s"}` }))}
                        />
                        <FormField label="Max uses" htmlFor="invite-uses">
                            <Input
                                id="invite-uses"
                                type="number"
                                min={1}
                                max={1000}
                                placeholder="Unlimited"
                                value={maxUses}
                                onChange={(e) => setMaxUses(e.target.value)}
                            />
                        </FormField>
                    </div>
                    {error && (
                        <p role="alert" className="text-[13px] text-destructive">
                            {error}
                        </p>
                    )}
                    <Button type="submit" size="lg" loading={busy}>
                        Create invite
                    </Button>
                </form>

                {createdCode && (
                    <div className="mt-5 rounded-lg bg-pastel-mint/60 p-4 dark:bg-pastel-mint/20">
                        <p className="text-[13px] font-medium text-foreground">Share this invite code</p>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            Copy it now: for security it <strong className="font-semibold text-foreground">won&apos;t be shown again</strong>.
                        </p>
                        <p className="my-4 text-center font-mono text-[26px] font-semibold tracking-[0.18em] text-foreground">{formatInviteCode(createdCode)}</p>
                        <ButtonGroup className="w-full">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => copyText(createdCode, "Invite code copied")}>
                                <Copy /> Copy code
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => copyText(`${window.location.origin}/invite/${createdCode}`, "Invite link copied")}
                            >
                                <Link2 /> Copy link
                            </Button>
                        </ButtonGroup>
                    </div>
                )}
            </section>

            <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-medium">{showAll ? "All invites" : "Active invites"}</h2>
                    <div className="flex items-center gap-2">
                        <Checkbox id="show-all" checked={showAll} onCheckedChange={(v) => setShowAll(v === true)} />
                        <Label htmlFor="show-all" className="text-[13px] font-normal text-muted-foreground">
                            Show expired and used
                        </Label>
                    </div>
                </div>
                {!data ? (
                    <Skeleton className="h-24 w-full" />
                ) : invites.length === 0 ? (
                    <EmptyState title="No active invites">Invites you create show up here until they expire, run out of uses or you revoke them.</EmptyState>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {invites.map((inv) => (
                            <li key={inv.id} className="flex items-start gap-3 px-4 py-3">
                                <span className="mt-0.5 text-muted-foreground">{inv.kind === "email" ? <Mail className="size-4" /> : <Link2 className="size-4" />}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm">
                                        {inv.kind === "email"
                                            ? `Email invite for ${inv.email}` // created before invitations became links-only
                                            : `Invite${inv.maxUses ? `, ${inv.uses} of ${inv.maxUses} used` : `, used ${inv.uses} time${inv.uses === 1 ? "" : "s"}`}`}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {ROLE_LABEL[inv.orgRole]}
                                        {inv.team ? ` and ${ROLE_LABEL[inv.teamRole ?? "viewer"].toLowerCase()} on ${inv.team.name}` : ""}.{" "}
                                        {inv.status === "active" ? (
                                            <span title={formatDate(inv.expiresAt)}>Expires {timeAgo(inv.expiresAt)}</span>
                                        ) : (
                                            <span>Created {timeAgo(inv.createdAt)}</span>
                                        )}
                                        {inv.createdBy ? ` by ${inv.createdBy}` : ""}
                                    </p>
                                </div>
                                {inv.status === "active" ? (
                                    <Button variant="ghost" size="sm" onClick={() => setRevoking(inv)}>
                                        <X /> Revoke
                                    </Button>
                                ) : (
                                    <Badge variant="secondary">{STATUS_LABEL[inv.status]}</Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
            </section>
            <ConfirmDialog
                open={!!revoking}
                onOpenChange={(o) => !o && setRevoking(null)}
                title="Revoke this invite?"
                description="Its code and link stop working right away. People who already joined keep their access."
                confirmText="revoke"
                actionLabel="Revoke invite"
                onConfirm={async () => {
                    try {
                        await api(`${key}/${revoking!.id}`, { method: "DELETE" });
                        toast.success("Invite revoked");
                        mutate();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
        </div>
    );
}
