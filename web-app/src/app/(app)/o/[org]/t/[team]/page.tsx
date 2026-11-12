"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { FolderPlus, MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer } from "@/components/app/app-shell";
import { CreateProjectDialog } from "@/components/app/dialogs";
import { QuickCreateDialog } from "@/components/quick-create-dialog";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { ROLE_LABEL, useOrg } from "@/components/app/org-context";
import { PeoplePicker } from "@/components/app/people-picker";
import { RestrictedLock } from "@/components/app/project-access-dialog";
import { LoadError, LoadingPage } from "@/components/app/states";
import { api, fetcher } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { FormField, UserAvatar, EmptyState, LoadMore, PageHeader, ToneBadge, ToneTile } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { usePaginated } from "@/lib/use-paginated";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type TeamData = {
    team: { id: string; name: string; slug: string; description: string; access: "manage" | "edit" | "view"; myRole: string | null };
    orgRole: string;
    projectCount: number;
    memberCount: number;
};

type OrgMember = { userId: string; name: string; email: string; role: string };

function AddMemberDialog({
    open,
    onOpenChange,
    existing,
    onAdded,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    existing: string[];
    onAdded: () => void;
}) {
    const { slug } = useOrg();
    const { team } = useParams<{ team: string }>();
    const { data } = useSWR<{ members: OrgMember[] }>(open ? `/api/orgs/${slug}/members?limit=100` : null, fetcher);
    const [userId, setUserId] = useState("");
    const [role, setRole] = useState<"editor" | "viewer">("viewer");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const candidates = (data?.members ?? []).filter((m) => !existing.includes(String(m.userId)));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Start in the people search, not on the "invite them" link in the description. */}
            <DialogContent
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    requestAnimationFrame(() => document.querySelector<HTMLInputElement>("[data-people-search]")?.focus());
                }}
            >
                <DialogHeader>
                    <DialogTitle>Add team member</DialogTitle>
                    <DialogDescription>{
                    <>
                        Choose someone already in the organization. To add someone new,{" "}
                        <Link href={`/o/${slug}/settings/invites`} className="text-foreground underline underline-offset-4">
                            invite them
                        </Link>{" "}
                        and pick this team.
                    </>
                }</DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setError(null);
                        try {
                            await api(`/api/orgs/${slug}/teams/${team}/members`, { body: { userId, role } });
                            toast.success("Added to team");
                            onAdded();
                            onOpenChange(false);
                            setUserId("");
                        } catch (err: any) {
                            setError(err.message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">Person</p>
                        {data ? (
                            <PeoplePicker
                                mode="single"
                                autoFocus
                                people={candidates.map((m) => ({ id: String(m.userId), name: m.name, email: m.email }))}
                                isChecked={(id) => id === userId}
                                onPick={setUserId}
                                emptyText="Everyone in the organization is already on this team."
                            />
                        ) : (
                            <Skeleton className="h-36 w-full rounded-lg" />
                        )}
                        {error && <p className="text-[13px] text-destructive">{error}</p>}
                    </div>
                    <FormField
                        label="Access"
                        htmlFor="role"
                        hint={role === "editor" ? "Can view and change variables in every project of this team." : "Can view variables but not change them."}
                    >
                        <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
                            <SelectTrigger id="role" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormField>
                    <DialogFooter>
                        <DialogCancel onClick={() => onOpenChange(false)} />
                        <DialogSubmit loading={busy} disabled={!userId}>
                            Add to team
                        </DialogSubmit>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditTeamDialog({
    open,
    onOpenChange,
    team,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    team: TeamData["team"];
    onSaved: () => void;
}) {
    const { slug } = useOrg();
    return (
        <QuickCreateDialog
            open={open}
            onOpenChange={onOpenChange}
            eyebrow="Edit team"
            namePlaceholder="Team name"
            initialName={team.name}
            description={{ placeholder: "What does this team work on? (optional)", initial: team.description }}
            hint={<>The URL stays <span className="font-mono">/t/{team.slug}</span></>}
            submitLabel="Save changes"
            onSubmit={async (name, description) => {
                await api(`/api/orgs/${slug}/teams/${team.slug}`, { method: "PATCH", body: { name, description } });
                toast.success("Team updated");
                onSaved();
            }}
        />
    );
}

type Project = {
    id: string;
    name: string;
    slug: string;
    description: string;
    restricted?: boolean;
    updatedAt: string;
    envCount: number;
    varCount: number;
};
type Member = { userId: string; name: string; email: string; image: string | null; role: "editor" | "viewer" };
type Tab = "projects" | "members";

function TabCount({ n }: { n: number | undefined }) {
    return <span className="text-xs font-normal tabular-nums text-muted-foreground">{n ?? "–"}</span>;
}

function ProjectCard({ p, href }: { p: Project; href: string }) {
    return (
        <Link
            href={href}
            className="flex h-full flex-col gap-4 rounded-lg p-4 ring-1 ring-border transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
            <div className="flex items-center gap-3">
                <ToneTile name={p.name} className="size-8 text-[13px]" />
                <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
                        <span className="truncate">{p.name}</span>
                        {p.restricted && <RestrictedLock />}
                    </p>
                    <p className="truncate font-mono text-[12px] text-muted-foreground">{p.slug}</p>
                </div>
            </div>
            <p className={cn("line-clamp-2 text-[13px] leading-relaxed", p.description ? "text-muted-foreground" : "text-muted-foreground/60")}>
                {p.description || "No description"}
            </p>
            <div className="mt-auto flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="tabular-nums">
                    {p.envCount} environment{p.envCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="tabular-nums">
                    {p.varCount} variable{p.varCount === 1 ? "" : "s"}
                </span>
                <span className="ml-auto shrink-0">{timeAgo(p.updatedAt)}</span>
            </div>
        </Link>
    );
}

function TeamView() {
    const params = useParams<{ org: string; team: string }>();
    const router = useRouter();
    const search = useSearchParams();
    const { slug, mutate: mutateOrg, isAdmin } = useOrg();
    const key = `/api/orgs/${params.org}/teams/${params.team}`;
    const { data, error, mutate } = useSWR<TeamData>(key, fetcher);
    const projects = usePaginated<Project>(data ? `${key}/projects` : null, "projects");
    const members = usePaginated<Member>(data ? `${key}/members` : null, "members");

    const tab: Tab = search.get("tab") === "members" ? "members" : "projects";
    const setTab = (t: string) => router.replace(t === "members" ? `?tab=members` : "?", { scroll: false });

    const [newProject, setNewProject] = useState(false);
    const [addMember, setAddMember] = useState(false);
    const [editTeam, setEditTeam] = useState(false);
    const [deleteTeam, setDeleteTeam] = useState(false);
    const [removing, setRemoving] = useState<Member | null>(null);

    if (error) return <LoadError error={error} notFoundTitle="Team not found" onRetry={() => mutate()} />;
    if (!data) return <LoadingPage />;

    const { team, projectCount, memberCount } = data;
    const canEdit = team.access !== "view";

    const refreshMembers = () => {
        members.mutate();
        mutate();
    };

    async function changeRole(userId: string, role: string) {
        try {
            await api(`${key}/members/${userId}`, { method: "PATCH", body: { role } });
            toast.success("Access updated");
            members.mutate();
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    const tabAction =
        tab === "projects"
            ? canEdit && (
                  <Button size="sm" onClick={() => setNewProject(true)}>
                      <FolderPlus /> New project
                  </Button>
              )
            : isAdmin && (
                  <Button size="sm" onClick={() => setAddMember(true)}>
                      <UserPlus /> Add member
                  </Button>
              );

    return (
        <PageContainer>
            <PageHeader
                title={
                    <span className="flex items-center gap-3">
                        {team.name}
                        {team.access === "view" && <ToneBadge tone="peach">Read-only</ToneBadge>}
                        {team.access === "edit" && <ToneBadge tone="mint">Editor</ToneBadge>}
                    </span>
                }
                description={team.description || undefined}
                actions={
                    isAdmin && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon-sm" aria-label="Team options">
                                    <MoreHorizontal />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setEditTeam(true)}>
                                    <Pencil /> Edit team
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTeam(true)}>
                                    <Trash2 /> Delete team
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                }
            />

            <Tabs value={tab} onValueChange={setTab} className="gap-0">
                {/* Tab row: tabs on the left sit on the divider; the open tab's action is on the right. */}
                <div className="mb-5 flex items-end justify-between gap-4 border-b">
                    <div className="no-scrollbar -mb-px overflow-x-auto overflow-y-hidden pb-px">
                        <TabsList variant="line" aria-label="Team sections">
                            <TabsTrigger value="projects" className="px-2.5">
                                Projects <TabCount n={projects.total ?? projectCount} />
                            </TabsTrigger>
                            <TabsTrigger value="members" className="px-2.5">
                                Members <TabCount n={members.total ?? memberCount} />
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="shrink-0 pb-2">{tabAction}</div>
                </div>

                <TabsContent value="projects">
                    {projects.isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {[0, 1, 2].map((i) => (
                                <Skeleton key={i} className="h-36 rounded-lg" />
                            ))}
                        </div>
                    ) : projects.items.length === 0 ? (
                        <EmptyState
                            title="No projects yet"
                            action={
                                canEdit && (
                                    <Button size="sm" onClick={() => setNewProject(true)}>
                                        <FolderPlus /> New project
                                    </Button>
                                )
                            }
                        >
                            {canEdit
                                ? "A project holds the variables for one app or service, split into environments."
                                : "When editors create projects in this team, they'll appear here."}
                        </EmptyState>
                    ) : (
                        <>
                            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {projects.items.map((p) => (
                                    <li key={p.id}>
                                        <ProjectCard p={p} href={`/o/${slug}/t/${team.slug}/p/${p.slug}`} />
                                    </li>
                                ))}
                            </ul>
                            <LoadMore hasMore={projects.hasMore} loading={projects.loadingMore} onClick={projects.loadMore} />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="members">
                    {members.isLoading ? (
                        <Skeleton className="h-16 rounded-lg" />
                    ) : members.items.length === 0 ? (
                        <div className="flex flex-col items-start gap-4 rounded-lg bg-muted/40 p-5 sm:flex-row sm:items-center">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-sky text-pastel-sky-fg">
                                <Users className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">No members yet</p>
                                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                                    Add people from your organization as <strong className="font-semibold text-foreground">editors</strong> or{" "}
                                    <strong className="font-semibold text-foreground">viewers</strong>. Owners and admins can already open every team.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y overflow-hidden rounded-lg ring-1 ring-border">
                                {members.items.map((m) => (
                                    <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                                        <UserAvatar name={m.name} src={m.image} className="size-8" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                                        </div>
                                        {isAdmin ? (
                                            <>
                                                <Select value={m.role} onValueChange={(v) => changeRole(String(m.userId), v)}>
                                                    <SelectTrigger size="sm" aria-label={`Access for ${m.name}`} className="w-28">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent align="end">
                                                        <SelectItem value="viewer">Viewer</SelectItem>
                                                        <SelectItem value="editor">Editor</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}>
                                                    <Trash2 />
                                                </Button>
                                            </>
                                        ) : (
                                            <ToneBadge tone={roleTone(m.role)}>{ROLE_LABEL[m.role]}</ToneBadge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <LoadMore hasMore={members.hasMore} loading={members.loadingMore} onClick={members.loadMore} />
                        </>
                    )}
                </TabsContent>
            </Tabs>

            <CreateProjectDialog
                open={newProject}
                onOpenChange={setNewProject}
                teamSlug={team.slug}
                teamName={team.name}
                onCreated={() => {
                    projects.mutate();
                    mutate();
                }}
            />
            <AddMemberDialog
                open={addMember}
                onOpenChange={setAddMember}
                existing={members.items.map((m) => String(m.userId))}
                onAdded={() => {
                    refreshMembers();
                    setTab("members");
                }}
            />
            {editTeam && (
                <EditTeamDialog
                    open={editTeam}
                    onOpenChange={setEditTeam}
                    team={team}
                    onSaved={() => {
                        mutate();
                        mutateOrg();
                    }}
                />
            )}
            <ConfirmDialog
                open={!!removing}
                onOpenChange={(o) => !o && setRemoving(null)}
                title={`Remove ${removing?.name} from ${team.name}?`}
                description="They'll lose access to this team's projects right away, including through their API tokens. They stay in the organization."
                confirmText={removing?.email}
                actionLabel="Remove from team"
                onConfirm={async () => {
                    try {
                        await api(`${key}/members/${removing!.userId}`, { method: "DELETE" });
                        toast.success("Removed from team");
                        refreshMembers();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
            <ConfirmDialog
                open={deleteTeam}
                onOpenChange={setDeleteTeam}
                title={`Delete ${team.name}?`}
                description={
                    projectCount
                        ? `This permanently deletes ${projectCount} project${projectCount === 1 ? "" : "s"} and all of their variables. This can't be undone.`
                        : "This team has no projects. Its members lose access to it."
                }
                confirmText={team.slug}
                actionLabel="Delete team"
                onConfirm={async (typed) => {
                    try {
                        await api(key, { method: "DELETE", body: { confirm: typed || undefined } });
                        toast.success(`Deleted ${team.name}`);
                        await mutateOrg();
                        router.push(`/o/${slug}`);
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
        </PageContainer>
    );
}

export default function TeamPage() {
    // useSearchParams (the open tab) needs a Suspense boundary.
    return (
        <Suspense fallback={<LoadingPage />}>
            <TeamView />
        </Suspense>
    );
}
