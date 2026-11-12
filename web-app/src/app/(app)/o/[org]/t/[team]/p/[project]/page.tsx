"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowRightLeft, Lock, MoreHorizontal, Pencil, Plus, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer } from "@/components/app/app-shell";
import { QuickCreateDialog } from "@/components/quick-create-dialog";
import { EnvEditor } from "@/components/app/env-editor";
import { ProjectAccessDialog, RestrictedLock } from "@/components/app/project-access-dialog";
import { MoveProjectDialog } from "@/components/app/move-project-dialog";
import { useOrg } from "@/components/app/org-context";
import { LoadError, LoadingPage } from "@/components/app/states";
import { api, fetcher } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { CopyButton, PageHeader, ToneBadge, ToneDot } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { envTone } from "@/lib/tones";

type ProjectData = {
    project: { id: string; name: string; slug: string; description: string; restricted?: boolean };
    team: { name: string; slug: string };
    org: { name: string; slug: string };
    access: "manage" | "edit" | "view";
    environments: { id: string; name: string; slug: string; varCount: number; updatedAt: string }[];
};

type EnvData = {
    environment: {
        id: string;
        name: string;
        slug: string;
        version: number;
        updatedAt: string;
        updatedBy: string | null;
        /** Values are null until the user unlocks them with an authenticator code. */
        vars: { key: string; value: string | null }[];
    };
    access: "manage" | "edit" | "view";
    /** When the user's server-side unlock ends; null while values are locked. */
    revealUntil: string | null;
    /** False when the user has no 2FA: values come unlocked. */
    revealRequired?: boolean;
};

function CliDialog({ open, onOpenChange, path }: { open: boolean; onOpenChange: (o: boolean) => void; path: string }) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const dotenv = `curl -fsS -H "Authorization: Bearer $ENVOY_TOKEN" \\\n  "${origin}/api/v1/${path}?format=dotenv" > .env`;
    const json = `curl -fsS -H "Authorization: Bearer $ENVOY_TOKEN" \\\n  "${origin}/api/v1/${path}"`;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Keep focus on the dialog itself; focusing the first copy button would pop its tooltip open. */}
            <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Fetch from the command line</DialogTitle>
                    <DialogDescription>{
                    <>
                        Use a personal access token from{" "}
                        <Link href="/account/tokens" className="text-foreground underline underline-offset-4">
                            API tokens
                        </Link>
                        . It gets the same access you have, so removing you from the team also cuts off the token.
                    </>
                }</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    {[
                        { label: "Write a .env file", code: dotenv },
                        { label: "Get JSON", code: json },
                    ].map((s) => (
                        <div key={s.label} className="min-w-0">
                            <p className="mb-1.5 text-[13px] font-medium">{s.label}</p>
                            <div className="relative rounded-lg bg-muted/70 dark:bg-input/40">
                                {/* Long URLs wrap instead of scrolling sideways; the copy button sits in the corner. */}
                                <pre className="whitespace-pre-wrap break-all py-3 pl-3.5 pr-12 font-mono text-[12.5px] leading-relaxed text-foreground">{s.code}</pre>
                                <div className="absolute right-1.5 top-1.5">
                                    <CopyButton value={s.code.replace(/\\\n\s*/g, " ")} label="Command" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EnvNameDialog({
    open,
    onOpenChange,
    title,
    initial,
    submitLabel,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    title: string;
    initial: string;
    submitLabel: string;
    onSubmit: (name: string) => Promise<void>;
}) {
    return (
        <QuickCreateDialog
            open={open}
            onOpenChange={onOpenChange}
            eyebrow={title}
            namePlaceholder="Environment name"
            initialName={initial}
            nameMaxLength={32}
            hint="For example: preview, qa, production-eu"
            submitLabel={submitLabel}
            onSubmit={(name) => onSubmit(name)}
        />
    );
}

function ProjectView() {
    const params = useParams<{ org: string; team: string; project: string }>();
    const search = useSearchParams();
    const router = useRouter();
    const { mutate: mutateOrg, isAdmin } = useOrg();
    const base = `/api/orgs/${params.org}/teams/${params.team}/projects/${params.project}`;

    const { data, error, mutate } = useSWR<ProjectData>(base, fetcher);
    const envs = data?.environments ?? [];
    const requested = search.get("env");
    const current = envs.find((e) => e.slug === requested) ?? envs.find((e) => e.slug === "development") ?? envs[0];

    const envKey = current ? `${base}/envs/${current.slug}` : null;
    const {
        data: envData,
        error: envError,
        mutate: mutateEnv,
    } = useSWR<EnvData>(envKey, fetcher, { revalidateOnFocus: false, revalidateIfStale: false });

    const reloadEnv = useCallback(() => mutateEnv(), [mutateEnv]);

    const [dirty, setDirty] = useState(false);
    const [cliOpen, setCliOpen] = useState(false);
    const [addEnvOpen, setAddEnvOpen] = useState(false);
    const [renameEnvOpen, setRenameEnvOpen] = useState(false);
    const [deleteEnvOpen, setDeleteEnvOpen] = useState(false);
    const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
    const [accessOpen, setAccessOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    /** Environment the user tried to switch to while the current one has unsaved edits. */
    const [pendingEnv, setPendingEnv] = useState<string | null>(null);
    const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

    if (error) return <LoadError error={error} notFoundTitle="Project not found" onRetry={() => mutate()} />;
    if (!data) return <LoadingPage />;

    const canEdit = data.access !== "view";
    const pagePath = `/o/${params.org}/t/${params.team}/p/${params.project}`;

    const goToEnv = (slug: string) => router.replace(`${pagePath}?env=${slug}`, { scroll: false });
    const switchEnv = (slug: string) => {
        if (slug === current?.slug) return;
        if (dirty) setPendingEnv(slug); // ask first, in an app dialog
        else goToEnv(slug);
    };
    const pendingEnvName = envs.find((e) => e.slug === pendingEnv)?.name;

    return (
        <PageContainer>
            <PageHeader
                title={
                    <span className="flex items-center gap-3">
                        <span className="truncate">{data.project.name}</span>
                        {data.project.restricted && <RestrictedLock className="[&_svg]:size-4" />}
                        {!canEdit && <ToneBadge tone="peach">Read-only</ToneBadge>}
                    </span>
                }
                description={data.project.description || undefined}
                actions={
                    <ButtonGroup>
                        <Button variant="outline" size="sm" onClick={() => setCliOpen(true)}>
                            <Terminal /> Use from CLI
                        </Button>
                        {(canEdit || isAdmin) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon-sm" aria-label="Project options">
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {canEdit && (
                                        <DropdownMenuItem onSelect={() => setAddEnvOpen(true)}>
                                            <Plus /> Add environment
                                        </DropdownMenuItem>
                                    )}
                                    {canEdit && current && (
                                        <DropdownMenuItem onSelect={() => setRenameEnvOpen(true)}>
                                            <Pencil /> Rename {current.name}
                                        </DropdownMenuItem>
                                    )}
                                    {isAdmin && (
                                        <>
                                            <DropdownMenuItem onSelect={() => setAccessOpen(true)}>
                                                <Lock /> Manage access
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() => (dirty ? toast.error("Save or discard your changes first.") : setMoveOpen(true))}
                                            >
                                                <ArrowRightLeft /> Move to another team
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {current && envs.length > 1 && (
                                                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteEnvOpen(true)}>
                                                    <Trash2 /> Delete {current.name}
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteProjectOpen(true)}>
                                                <Trash2 /> Delete project
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </ButtonGroup>
                }
            />

            <div className="mb-5 flex items-end justify-between gap-4 border-b">
                <div className="no-scrollbar -mb-px flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden pb-px">
                    {/* Manual activation: focus alone (e.g. returning from the discard dialog) must not switch environments. */}
                    <Tabs value={current?.slug} onValueChange={switchEnv} activationMode="manual">
                        <TabsList variant="line" aria-label="Environments">
                            {envs.map((env) => (
                                <TabsTrigger key={env.id} value={env.slug} className="px-2.5">
                                    <ToneDot tone={envTone(env.slug)} />
                                    {env.name}
                                    <span className="text-xs font-normal tabular-nums text-muted-foreground">{env.varCount}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    {canEdit && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Add environment" onClick={() => setAddEnvOpen(true)}>
                                    <Plus />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add environment</TooltipContent>
                        </Tooltip>
                    )}
                </div>
                {envData && (
                    <p className="hidden shrink-0 pb-2.5 text-xs text-muted-foreground md:block">
                        {envData.environment.updatedBy
                            ? `Saved by ${envData.environment.updatedBy} ${timeAgo(envData.environment.updatedAt)}`
                            : `Created ${timeAgo(envData.environment.updatedAt)}`}
                    </p>
                )}
            </div>

            {envError ? (
                <p className="text-sm text-destructive">{(envError as Error).message}</p>
            ) : !envData || !current ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-full" />
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))}
                </div>
            ) : (
                <EnvEditor
                    apiBase={envKey!}
                    initialFilter={search.get("key") ?? undefined}
                    envName={envData.environment.name}
                    envSlug={envData.environment.slug}
                    canEdit={canEdit}
                    vars={envData.environment.vars}
                    version={envData.environment.version}
                    updatedBy={envData.environment.updatedBy}
                    revealUntil={envData.revealUntil}
                    revealRequired={envData.revealRequired !== false}
                    onReload={reloadEnv}
                    onDirtyChange={onDirtyChange}
                    onSaved={() => {
                        mutateEnv();
                        mutate();
                    }}
                />
            )}

            <CliDialog
                open={cliOpen}
                onOpenChange={setCliOpen}
                path={`${params.org}/${params.team}/${params.project}/${current?.slug ?? "development"}`}
            />
            {addEnvOpen && (
                <EnvNameDialog
                    open={addEnvOpen}
                    onOpenChange={setAddEnvOpen}
                    title="Add environment"
                    initial=""
                    submitLabel="Add environment"
                    onSubmit={async (name) => {
                        const res = await api<{ environment: { slug: string } }>(`${base}/envs`, { body: { name } });
                        await mutate();
                        toast.success(`Added ${name}`);
                        router.replace(`${pagePath}?env=${res.environment.slug}`, { scroll: false });
                    }}
                />
            )}
            {renameEnvOpen && current && (
                <EnvNameDialog
                    open={renameEnvOpen}
                    onOpenChange={setRenameEnvOpen}
                    title={`Rename ${current.name}`}
                    initial={current.name}
                    submitLabel="Rename"
                    onSubmit={async (name) => {
                        await api(`${base}/envs/${current.slug}`, { method: "PATCH", body: { name } });
                        await Promise.all([mutate(), mutateEnv()]);
                        toast.success("Environment renamed");
                    }}
                />
            )}
            <MoveProjectDialog
                open={moveOpen}
                onOpenChange={setMoveOpen}
                projectUrl={base}
                projectName={data.project.name}
                projectSlug={data.project.slug}
                teamSlug={params.team}
                restricted={!!data.project.restricted}
                onMoved={async (teamSlug, teamName) => {
                    toast.success(`Moved ${data.project.name} to ${teamName}`);
                    await mutateOrg();
                    router.replace(`/o/${params.org}/t/${teamSlug}/p/${data.project.slug}${current ? `?env=${current.slug}` : ""}`);
                }}
            />
            {accessOpen && (
                <ProjectAccessDialog
                    open={accessOpen}
                    onOpenChange={setAccessOpen}
                    projectUrl={base}
                    projectName={data.project.name}
                    teamName={data.team.name}
                    onSaved={() => {
                        mutate();
                        mutateOrg();
                    }}
                />
            )}
            <ConfirmDialog
                open={!!pendingEnv}
                onOpenChange={(o) => !o && setPendingEnv(null)}
                title="Discard unsaved changes?"
                description={
                    <>
                        Your edits to <strong className="font-semibold text-foreground">{current?.name}</strong> haven&apos;t been saved. Switching to{" "}
                        <strong className="font-semibold text-foreground">{pendingEnvName}</strong> discards them.
                    </>
                }
                cancelLabel="Keep editing"
                actionLabel="Discard and switch"
                onConfirm={() => {
                    if (pendingEnv) goToEnv(pendingEnv);
                    setPendingEnv(null);
                }}
            />
            <ConfirmDialog
                open={deleteEnvOpen}
                onOpenChange={setDeleteEnvOpen}
                title={`Delete ${current?.name}?`}
                description={`All ${current?.varCount ?? 0} variables in this environment will be permanently deleted. Anything fetching them will start failing.`}
                confirmText={current?.slug}
                actionLabel="Delete environment"
                onConfirm={async () => {
                    try {
                        await api(`${base}/envs/${current!.slug}`, { method: "DELETE" });
                        toast.success(`Deleted ${current!.name}`);
                        await mutate();
                        router.replace(pagePath, { scroll: false });
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
            <ConfirmDialog
                open={deleteProjectOpen}
                onOpenChange={setDeleteProjectOpen}
                title={`Delete ${data.project.name}?`}
                description="Every environment and variable in this project will be permanently deleted."
                confirmText={data.project.slug}
                actionLabel="Delete project"
                onConfirm={async (typed) => {
                    try {
                        await api(base, { method: "DELETE", body: { confirm: typed } });
                        toast.success(`Deleted ${data.project.name}`);
                        await mutateOrg();
                        router.push(`/o/${params.org}/t/${params.team}`);
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
        </PageContainer>
    );
}

export default function ProjectPage() {
    return (
        <Suspense fallback={<LoadingPage />}>
            <ProjectView />
        </Suspense>
    );
}
