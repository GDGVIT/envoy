"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { Command as CommandPrimitive } from "cmdk";
import {
    ArrowLeftRight,
    Building2,
    Folder,
    KeyRound,
    Layers,
    LayoutGrid,
    Mail,
    Moon,
    Plus,
    ScrollText,
    Search,
    Settings,
    Sun,
    User,
    Users,
    Variable,
} from "lucide-react";
import { CommandDialog, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { fetcher } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useOrg } from "./org-context";

type SearchResults = {
    environments: { name: string; slug: string; project: { name: string; slug: string }; team: { name: string; slug: string } }[];
    variables: { key: string; env: { name: string; slug: string }; project: { name: string; slug: string }; team: { name: string; slug: string } }[];
};
type OrgListItem = { id: string; name: string; slug: string };

/** Coloured square per kind of result, so groups are easy to tell apart at a glance. */
const TONES = {
    project: "bg-pastel-mint text-pastel-mint-fg",
    team: "bg-pastel-lavender text-pastel-lavender-fg",
    env: "bg-pastel-sky text-pastel-sky-fg",
    variable: "bg-pastel-lemon text-pastel-lemon-fg",
    org: "bg-pastel-peach text-pastel-peach-fg",
    page: "bg-muted text-muted-foreground",
} as const;

/**
 * Plain substring matching (cmdk's default is fuzzy, so "prod" matched "Billing" through scattered
 * letters). Items are matched on their keywords; a whole-string or word prefix ranks above a match
 * in the middle of a word.
 */
function matchScore(value: string, search: string, keywords?: string[]) {
    const s = search.trim().toLowerCase();
    if (!s) return 1;
    const hay = (keywords?.length ? keywords : [value]).map((k) => k.toLowerCase());
    if (hay.some((h) => h.startsWith(s))) return 1;
    if (hay.some((h) => h.split(/[\s_\-./·]+/).some((w) => w.startsWith(s)))) return 0.8;
    if (hay.some((h) => h.includes(s))) return 0.5;
    return 0;
}

/** Bolds the part of `text` that matches the query. */
function Highlight({ text, query }: { text: string; query: string }) {
    const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (i < 0) return <>{text}</>;
    return (
        <>
            {text.slice(0, i)}
            <mark className="bg-transparent font-semibold text-foreground">{text.slice(i, i + query.length)}</mark>
            {text.slice(i + query.length)}
        </>
    );
}

function Row({
    icon: Icon,
    tone,
    title,
    meta,
    value,
    keywords,
    onSelect,
    mono,
}: {
    icon: React.ElementType;
    tone: keyof typeof TONES;
    title: React.ReactNode;
    meta?: React.ReactNode;
    value: string;
    keywords?: string[];
    onSelect: () => void;
    mono?: boolean;
}) {
    return (
        <CommandItem value={value} keywords={keywords} onSelect={onSelect} className="h-11 gap-3 px-2.5 [&>svg:last-child]:hidden">
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONES[tone])}>
                <Icon className="size-3.5" />
            </span>
            <span className={cn("min-w-0 truncate text-muted-foreground", mono && "font-mono text-[13px]")}>{title}</span>
            {meta && <span className="ml-auto max-w-[45%] shrink-0 truncate text-[12px] text-muted-foreground">{meta}</span>}
            <Kbd className={cn("hidden shrink-0 group-data-selected/command-item:inline-flex", !meta && "ml-auto")}>↵</Kbd>
        </CommandItem>
    );
}

/**
 * ⌘K menu: jump to any project, team, environment or variable you can see, open a page, or run an action.
 * Projects and teams are matched in the browser; environments and variable names come from the server
 * (names only, never values).
 */
export function CommandPalette({
    open,
    onOpenChange,
    onCreateTeam,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateTeam: () => void;
}) {
    const router = useRouter();
    const { data, slug, isAdmin } = useOrg();
    const { resolvedTheme, setTheme } = useTheme();
    const { data: orgList } = useSWR<{ orgs: OrgListItem[] }>(open ? "/api/orgs" : null, fetcher);

    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebounced(query.trim()), 150);
        return () => clearTimeout(t);
    }, [query]);
    useEffect(() => {
        if (!open) {
            setQuery("");
            setDebounced("");
        }
    }, [open]);

    const searchKey = open && slug && debounced.length >= 2 ? `/api/orgs/${slug}/search?q=${encodeURIComponent(debounced)}` : null;
    const { data: found, isLoading } = useSWR<SearchResults>(searchKey, fetcher, { keepPreviousData: true });
    const searching = query.trim().length > 0;
    const remote = searching && debounced.length >= 2 ? found : undefined;

    const projects = useMemo(
        () =>
            (data?.teams ?? [])
                .flatMap((t) => t.projects.map((p) => ({ ...p, team: t })))
                .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
        [data]
    );
    // Without a query, show a short "recent" list; with one, everything is searchable.
    const shownProjects = searching ? projects : projects.slice(0, 5);
    const teams = data?.teams ?? [];
    const shownTeams = searching ? teams : teams.slice(0, 4);
    const otherOrgs = (orgList?.orgs ?? []).filter((o) => o.slug !== slug);

    // Keep a result selected so Enter always works: results from the server arrive after cmdk has
    // picked its first match, and would otherwise leave nothing highlighted.
    const [selected, setSelected] = useState("");
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            const list = listRef.current;
            if (!list) return;
            const items = [...list.querySelectorAll<HTMLElement>("[cmdk-item]")];
            if (!items.some((el) => el.dataset.value === selected) && items[0]?.dataset.value) setSelected(items[0].dataset.value);
        });
        return () => cancelAnimationFrame(id);
    }, [found, query, selected, open]);

    const run = (fn: () => void) => {
        onOpenChange(false);
        fn();
    };
    const go = (href: string) => run(() => router.push(href));
    const base = slug ? `/o/${slug}` : null;
    const q = query.trim();
    const dark = resolvedTheme === "dark";

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Command menu"
            description="Search projects, teams, environments and variables"
            className="top-[14%] sm:max-w-xl"
        >
            {/* The dialog doesn't provide the cmdk root itself; CommandPrimitive.Input needs one. */}
            <CommandPrimitive loop filter={matchScore} value={selected} onValueChange={setSelected} className="flex flex-col bg-popover text-popover-foreground">
                <div className="flex items-center gap-3 border-b px-4">
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                    <CommandPrimitive.Input
                        value={query}
                        onValueChange={setQuery}
                        placeholder="Search projects, teams, environments, variables…"
                        className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
                    />
                    {isLoading && searchKey ? <Spinner className="size-4 text-muted-foreground" /> : <Kbd>Esc</Kbd>}
                </div>

                <CommandList ref={listRef} className="max-h-[min(60vh,460px)] scroll-py-2 p-2">
                    <CommandPrimitive.Empty className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                        <span className="text-sm text-foreground">No results for &ldquo;{q}&rdquo;</span>
                        <span className="text-[13px] text-muted-foreground">
                            {q.length < 2 ? "Keep typing to search variables too." : "Try a project, team, environment or variable name."}
                        </span>
                    </CommandPrimitive.Empty>

                    {shownProjects.length > 0 && (
                        <CommandGroup heading={searching ? "Projects" : "Recently updated"}>
                            {shownProjects.map((p) => (
                                <Row
                                    key={p.id}
                                    icon={Folder}
                                    tone="project"
                                    value={`project ${p.id}`}
                                    keywords={[p.name, p.slug, p.team.name]}
                                    title={
                                        <span className="text-foreground">
                                            <Highlight text={p.name} query={q} />
                                        </span>
                                    }
                                    meta={p.team.name}
                                    onSelect={() => go(`${base}/t/${p.team.slug}/p/${p.slug}`)}
                                />
                            ))}
                        </CommandGroup>
                    )}

                    {remote && remote.environments.length > 0 && (
                        <CommandGroup heading="Environments">
                            {remote.environments.map((e) => (
                                <Row
                                    key={`${e.team.slug}/${e.project.slug}/${e.slug}`}
                                    icon={Layers}
                                    tone="env"
                                    value={`env ${e.team.slug} ${e.project.slug} ${e.slug}`}
                                    keywords={[q, e.name, e.project.name]}
                                    title={
                                        <>
                                            {e.project.name} <span className="text-muted-foreground/60">/</span>{" "}
                                            <span className="text-foreground">
                                                <Highlight text={e.name} query={q} />
                                            </span>
                                        </>
                                    }
                                    meta={e.team.name}
                                    onSelect={() => go(`${base}/t/${e.team.slug}/p/${e.project.slug}?env=${e.slug}`)}
                                />
                            ))}
                        </CommandGroup>
                    )}

                    {remote && remote.variables.length > 0 && (
                        <CommandGroup heading="Variables">
                            {remote.variables.map((v) => (
                                <Row
                                    key={`${v.team.slug}/${v.project.slug}/${v.env.slug}/${v.key}`}
                                    icon={Variable}
                                    tone="variable"
                                    mono
                                    value={`var ${v.team.slug} ${v.project.slug} ${v.env.slug} ${v.key}`}
                                    keywords={[q, v.key]}
                                    title={
                                        <span className="text-foreground">
                                            <Highlight text={v.key} query={q} />
                                        </span>
                                    }
                                    meta={`${v.project.name} · ${v.env.name}`}
                                    onSelect={() =>
                                        go(`${base}/t/${v.team.slug}/p/${v.project.slug}?env=${v.env.slug}&key=${encodeURIComponent(v.key)}`)
                                    }
                                />
                            ))}
                        </CommandGroup>
                    )}

                    {shownTeams.length > 0 && (
                        <CommandGroup heading="Teams">
                            {shownTeams.map((t) => (
                                <Row
                                    key={t.id}
                                    icon={Users}
                                    tone="team"
                                    value={`team ${t.id}`}
                                    keywords={[t.name, t.slug]}
                                    title={
                                        <span className="text-foreground">
                                            <Highlight text={t.name} query={q} />
                                        </span>
                                    }
                                    meta={`${t.projects.length} project${t.projects.length === 1 ? "" : "s"} · ${t.memberCount} member${t.memberCount === 1 ? "" : "s"}`}
                                    onSelect={() => go(`${base}/t/${t.slug}`)}
                                />
                            ))}
                        </CommandGroup>
                    )}

                    <CommandSeparator className="mx-1 my-1" />
                    <CommandGroup heading="Go to">
                        {base && (
                            <Row icon={LayoutGrid} tone="page" value="Overview" keywords={["Overview", "home", "dashboard"]} title={<span className="text-foreground">Overview</span>} onSelect={() => go(base)} />
                        )}
                        {base && (
                            <Row icon={Settings} tone="page" value="Organization settings" keywords={["Organization settings", "general", "rename"]} title={<span className="text-foreground">Organization settings</span>} onSelect={() => go(`${base}/settings`)} />
                        )}
                        {base && (
                            <Row icon={Users} tone="page" value="Members" keywords={["Members", "people", "roles"]} title={<span className="text-foreground">Members</span>} onSelect={() => go(`${base}/settings/members`)} />
                        )}
                        {base && isAdmin && (
                            <Row icon={ScrollText} tone="page" value="Audit log" keywords={["Audit log", "history", "activity"]} title={<span className="text-foreground">Audit log</span>} onSelect={() => go(`${base}/settings/audit`)} />
                        )}
                        <Row icon={User} tone="page" value="Account and security" keywords={["Account and security", "password", "2fa", "profile"]} title={<span className="text-foreground">Account and security</span>} onSelect={() => go("/account")} />
                        <Row icon={KeyRound} tone="page" value="API tokens" keywords={["API tokens", "pat", "cli", "token"]} title={<span className="text-foreground">API tokens</span>} onSelect={() => go("/account/tokens")} />
                    </CommandGroup>

                    <CommandGroup heading="Actions">
                        {base && isAdmin && (
                            <Row icon={Plus} tone="page" value="Create team" keywords={["Create team", "new team"]} title={<span className="text-foreground">Create team</span>} onSelect={() => run(onCreateTeam)} />
                        )}
                        {base && isAdmin && (
                            <Row icon={Mail} tone="page" value="Invite people" keywords={["Invite people", "invite", "add member"]} title={<span className="text-foreground">Invite people</span>} onSelect={() => go(`${base}/settings/invites`)} />
                        )}
                        <Row icon={Building2} tone="page" value="Create organization" keywords={["Create organization", "new org"]} title={<span className="text-foreground">Create organization</span>} onSelect={() => go("/onboarding")} />
                        <Row
                            icon={dark ? Sun : Moon}
                            tone="page"
                            value="Switch theme"
                            keywords={["dark", "light", "theme"]}
                            title={<span className="text-foreground">Switch to {dark ? "light" : "dark"} theme</span>}
                            onSelect={() => run(() => setTheme(dark ? "light" : "dark"))}
                        />
                    </CommandGroup>

                    {otherOrgs.length > 0 && (
                        <CommandGroup heading="Switch organization">
                            {otherOrgs.map((o) => (
                                <Row
                                    key={o.id}
                                    icon={ArrowLeftRight}
                                    tone="org"
                                    value={`org ${o.id}`}
                                    keywords={[o.name, o.slug, "switch organization"]}
                                    title={
                                        <span className="text-foreground">
                                            <Highlight text={o.name} query={q} />
                                        </span>
                                    }
                                    onSelect={() => go(`/o/${o.slug}`)}
                                />
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>

                <div className="flex items-center gap-4 border-t px-4 py-2.5 text-[12px] text-muted-foreground">
                    <span className="min-w-0 truncate">{data ? <>Searching in {data.org.name}</> : "Search"}</span>
                    <span className="ml-auto hidden items-center gap-1 sm:flex">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd> Navigate
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>↵</Kbd> Open
                    </span>
                    <span className="hidden items-center gap-1 sm:flex">
                        <Kbd>⌘K</Kbd> Toggle
                    </span>
                </div>
            </CommandPrimitive>
        </CommandDialog>
    );
}
