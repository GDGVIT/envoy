"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
    Check,
    ChevronRight,
    ChevronsUpDown,
    KeyRound,
    LayoutGrid,
    LogOut,
    Moon,
    Plus,
    Search,
    Settings,
    Sun,
    User,
} from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RestrictedLock } from "@/components/app/project-access-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { UserAvatar, ToneTile } from "@/components/common";
import { api, fetcher } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { CreateTeamDialog } from "./dialogs";
import { OrgContext, OrgData, OrgRole, ROLE_LABEL, useOrg } from "./org-context";

type OrgListItem = { id: string; name: string; slug: string; role: OrgRole };
type Me = { user: { name: string; email: string; lastOrgSlug: string | null } };

function OrgSwitcher({ orgs }: { orgs: OrgListItem[] | undefined }) {
    const { data, slug } = useOrg();
    const router = useRouter();
    const current = orgs?.find((o) => o.slug === slug);
    const name = data?.org.name ?? current?.name ?? "Select organization";

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                                {name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="grid flex-1 text-left leading-tight">
                                <span className="truncate font-medium">{name}</span>
                                {current && <span className="truncate text-xs text-muted-foreground">{ROLE_LABEL[current.role]}</span>}
                            </span>
                            <ChevronsUpDown className="ml-auto text-muted-foreground" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-60">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
                        {orgs?.map((o) => (
                            <DropdownMenuItem key={o.id} onSelect={() => router.push(`/o/${o.slug}`)}>
                                <ToneTile name={o.name} className="size-5 rounded-sm text-[10px]" />
                                <span className="flex-1 truncate">{o.name}</span>
                                {o.slug === slug && <Check />}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
                            <Plus /> Create or join an organization
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function TeamsGroup({ onCreateTeam }: { onCreateTeam: () => void }) {
    const { data, slug, isAdmin } = useOrg();
    const params = useParams<{ team?: string; project?: string }>();

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Teams</SidebarGroupLabel>
            {isAdmin && !!data?.teams.length && (
                <SidebarGroupAction title="Create team" onClick={onCreateTeam}>
                    <Plus /> <span className="sr-only">Create team</span>
                </SidebarGroupAction>
            )}
            <SidebarGroupContent>
                <SidebarMenu>
                    {!data ? (
                        [72, 56, 64].map((w, i) => (
                            <SidebarMenuItem key={i} className="flex h-8 items-center px-2">
                                {/* Fixed widths: SidebarMenuSkeleton randomizes width, which mismatches during hydration. */}
                                <Skeleton className="h-4" style={{ width: `${w}%` }} />
                            </SidebarMenuItem>
                        ))
                    ) : data.teams.length === 0 ? (
                        isAdmin ? (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    onClick={onCreateTeam}
                                    className="border border-dashed border-sidebar-border text-muted-foreground hover:border-transparent"
                                >
                                    <Plus />
                                    <span>Create your first team</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ) : (
                            <SidebarMenuItem>
                                <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                                    You&apos;re not on a team yet. An admin can add you.
                                </p>
                            </SidebarMenuItem>
                        )
                    ) : (
                        data.teams.map((team) => (
                            <Collapsible key={team.id} asChild defaultOpen className="group/collapsible">
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive={params.team === team.slug && !params.project} tooltip={team.name}>
                                        <Link href={`/o/${slug}/t/${team.slug}`}>
                                            <ToneTile name={team.name} className="size-5 rounded-[5px] text-[10px]" />
                                            <span>{team.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuAction className="data-[state=open]:rotate-90" aria-label={`Toggle ${team.name} projects`}>
                                            <ChevronRight />
                                        </SidebarMenuAction>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {team.projects.length === 0 && (
                                                <li className="px-2 py-1 text-xs text-muted-foreground">No projects</li>
                                            )}
                                            {team.projects.map((p) => (
                                                <SidebarMenuSubItem key={p.id}>
                                                    <SidebarMenuSubButton
                                                        asChild
                                                        isActive={params.team === team.slug && params.project === p.slug}
                                                    >
                                                        <Link href={`/o/${slug}/t/${team.slug}/p/${p.slug}`}>
                                                            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{p.slug}</span>
                                                            {p.restricted && <RestrictedLock className="text-muted-foreground/70" />}
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        ))
                    )}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function UserMenu() {
    const { data: session } = useSession();
    const { resolvedTheme, setTheme } = useTheme();
    const router = useRouter();
    const user = session?.user;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                            <UserAvatar name={user?.name} src={user?.image} className="size-8" />
                            <span className="grid flex-1 text-left leading-tight">
                                <span className="truncate text-sm font-medium">{user?.name ?? "…"}</span>
                                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                            </span>
                            <ChevronsUpDown className="ml-auto text-muted-foreground" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                        <DropdownMenuItem onSelect={() => router.push("/account")}>
                            <User /> Account and security
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push("/account/tokens")}>
                            <KeyRound /> API tokens
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                            {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
                            <LogOut /> Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function AppSidebar({
    orgs,
    onSearch,
    onCreateTeam,
}: {
    orgs: OrgListItem[] | undefined;
    onSearch: () => void;
    onCreateTeam: () => void;
}) {
    const pathname = usePathname();
    const { slug } = useOrg();
    const { setOpenMobile } = useSidebar();
    const base = slug ? `/o/${slug}` : null;

    // Close the mobile sheet after navigating.
    useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

    return (
        <Sidebar collapsible="offcanvas">
            <SidebarHeader>
                <OrgSwitcher orgs={orgs} />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {base && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive={pathname === base}>
                                        <Link href={base}>
                                            <LayoutGrid /> <span>Overview</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            {base && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive={pathname.startsWith(`${base}/settings`)}>
                                        <Link href={`${base}/settings`}>
                                            <Settings /> <span>Organization settings</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                {base && <TeamsGroup onCreateTeam={onCreateTeam} />}
            </SidebarContent>
            <SidebarFooter>
                <UserMenu />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const params = useParams<{ org?: string }>();
    const { data: me } = useSWR<Me>("/api/me", fetcher);
    const { data: orgList } = useSWR<{ orgs: OrgListItem[] }>("/api/orgs", fetcher);

    const slug = params.org ?? me?.user.lastOrgSlug ?? orgList?.orgs[0]?.slug ?? null;
    const { data, error, mutate } = useSWR<OrgData>(slug ? `/api/orgs/${slug}` : null, fetcher);

    const [paletteOpen, setPaletteOpen] = useState(false);
    const [createTeamOpen, setCreateTeamOpen] = useState(false);

    // Remember the last org the user opened so /dashboard can return there.
    const rememberedSlug = useRef<string | null>(null);
    useEffect(() => {
        if (params.org && data?.org.slug === params.org && rememberedSlug.current !== params.org && me?.user.lastOrgSlug !== params.org) {
            rememberedSlug.current = params.org;
            api("/api/me", { method: "PATCH", body: { lastOrgSlug: params.org } }).catch(() => {});
        }
    }, [params.org, data, me]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const ctx = useMemo(
        () => ({
            slug,
            data,
            error,
            mutate,
            isAdmin: data?.org.role === "owner" || data?.org.role === "admin",
            isOwner: data?.org.role === "owner",
        }),
        [slug, data, error, mutate]
    );

    return (
        <OrgContext.Provider value={ctx}>
            <SidebarProvider>
                <AppSidebar
                    orgs={orgList?.orgs}
                    onSearch={() => setPaletteOpen(true)}
                    onCreateTeam={() => setCreateTeamOpen(true)}
                />
                <SidebarInset>
                    {/* Top bar: sidebar toggle, breadcrumbs for the current route, search. Same on every page. */}
                    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
                        <SidebarTrigger className="-ml-1 text-muted-foreground" />
                        <span aria-hidden className="h-4 w-px bg-border" />
                        <TopBarCrumbs />
                        <button
                            type="button"
                            onClick={() => setPaletteOpen(true)}
                            className="ml-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-muted/70 px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted sm:w-44 lg:w-64"
                        >
                            <Search className="size-3.5" />
                            <span className="hidden sm:inline">Search…</span>
                            <Kbd className="ml-auto hidden bg-background sm:inline-flex">⌘K</Kbd>
                        </button>
                    </header>
                    <main className="flex-1">{children}</main>
                </SidebarInset>
            </SidebarProvider>

            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onCreateTeam={() => setCreateTeamOpen(true)} />
            {slug && <CreateTeamDialog open={createTeamOpen} onOpenChange={setCreateTeamOpen} />}
        </OrgContext.Provider>
    );
}

/**
 * Every page in the app uses this frame: full width, the same gutters and vertical rhythm.
 * Inside it a page is always PageHeader (title, description, actions) followed by its content.
 */
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("w-full px-4 py-8 sm:px-6 lg:px-10 lg:py-10", className)}>{children}</div>;
}

type Crumb = { label: string; href?: string };

const SETTINGS_TABS: Record<string, string> = { "": "General", members: "Members", invites: "Invitations", audit: "Audit log" };

/** Breadcrumbs for the current route, built from the URL and the org data the shell already has. */
function useCrumbs(): Crumb[] {
    const pathname = usePathname() ?? "";
    const { data } = useOrg();
    const parts = pathname.split("/").filter(Boolean);

    if (parts[0] === "account") {
        return parts[1] === "tokens" ? [{ label: "Account", href: "/account" }, { label: "API tokens" }] : [{ label: "Account" }];
    }
    if (parts[0] !== "o" || !parts[1]) return [];

    const slug = parts[1];
    const base = `/o/${slug}`;
    const crumbs: Crumb[] = [{ label: data?.org.slug === slug ? data.org.name : slug, href: base }];

    if (parts[2] === "settings") {
        const tab = parts[3] ?? "";
        crumbs.push({ label: "Settings", href: tab ? `${base}/settings` : undefined });
        if (tab) crumbs.push({ label: SETTINGS_TABS[tab] ?? tab });
    } else if (parts[2] === "t" && parts[3]) {
        const team = data?.teams.find((t) => t.slug === parts[3]);
        const teamHref = `${base}/t/${parts[3]}`;
        if (parts[4] === "p" && parts[5]) {
            crumbs.push({ label: team?.name ?? parts[3], href: teamHref });
            crumbs.push({ label: team?.projects.find((p) => p.slug === parts[5])?.name ?? parts[5] });
        } else {
            crumbs.push({ label: team?.name ?? parts[3] });
        }
    } else {
        crumbs.push({ label: "Overview" });
    }
    return crumbs;
}

function TopBarCrumbs() {
    const crumbs = useCrumbs();
    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
                {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    // On narrow screens only the last two levels show.
                    const hideOnMobile = i < crumbs.length - 2;
                    return (
                        <Fragment key={i}>
                            {/* A separator hides on mobile whenever the item before it is hidden. */}
                            {i > 0 && <BreadcrumbSeparator className={cn(i <= crumbs.length - 2 && "max-sm:hidden")} />}
                            <BreadcrumbItem className={cn("min-w-0", hideOnMobile && "max-sm:hidden")}>
                                {last || !c.href ? (
                                    <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link href={c.href} className="truncate">
                                            {c.label}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
