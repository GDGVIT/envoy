"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Lock, Users, Zap } from "lucide-react";
import {
    siDocker,
    siGithubactions,
    siGitlab,
    siGnubash,
    siKubernetes,
    siNextdotjs,
    siNodedotjs,
    siPython,
    siRailway,
    siVercel,
    type SimpleIcon,
} from "simple-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WordReveal, useScrollProgress } from "./motion";
import { Reveal, useInView } from "./reveal";
import { GlassPanes } from "./glass-panes";

/** Emphasis for the key part of a description: full-strength text, semibold. */
function Em({ children }: { children: React.ReactNode }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
}

/* ── Hero: pastel gradient, translucent glass facets, headline bottom-left ── */

export function Hero() {
    const { data: session } = useSession();
    const signedIn = !!session?.user?.mfaVerified;
    return (
        <div className="relative">
            <GlassPanes className="h-[78%]" />

            <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-10 pt-40 sm:px-6">
                <h1 className="max-w-3xl text-[2.75rem] font-normal leading-[1.02] tracking-[-0.045em] text-foreground sm:text-7xl">
                    <WordReveal delay={200} lines={[[{ text: "Keep every secret" }], [{ text: "in the right hands" }]]} />
                </h1>
                <div
                    className="mt-10 flex flex-col gap-6 border-b border-foreground/15 pb-8 text-[13px] text-foreground/70 animate-word-in sm:flex-row sm:items-center"
                    style={{ animationDelay: "700ms" }}
                >
                    <p className="max-w-[17rem]">
                        Store your team&apos;s environment variables <Em>encrypted</Em>, organized by <Em>team and project</Em>.
                    </p>
                    <ArrowRight className="hidden size-4 shrink-0 sm:block" />
                    <p className="max-w-[14rem]">
                        Pull them anywhere with <Em>one command</Em>.
                    </p>
                    <div className="flex items-center gap-2 sm:ml-auto">
                        {signedIn ? (
                            <Button asChild>
                                <Link href="/dashboard">
                                    Open dashboard <ArrowRight />
                                </Link>
                            </Button>
                        ) : (
                            <>
                                <Button asChild>
                                    <Link href="/signup">Get started</Link>
                                </Button>
                                <Button asChild variant="ghost">
                                    <Link href="/login">Sign in</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Tool grid (2 × 5 cells, hairline dividers) ──────────────────────────── */

const TOOLS: { icon: SimpleIcon; name: string }[] = [
    { icon: siGithubactions, name: "GitHub Actions" },
    { icon: siDocker, name: "Docker" },
    { icon: siVercel, name: "Vercel" },
    { icon: siKubernetes, name: "Kubernetes" },
    { icon: siGitlab, name: "GitLab CI" },
    { icon: siNodedotjs, name: "Node.js" },
    { icon: siPython, name: "Python" },
    { icon: siRailway, name: "Railway" },
    { icon: siGnubash, name: "Any shell" },
    { icon: siNextdotjs, name: "Next.js" },
];

/** Brand logo in its brand color; near-black marks (Vercel, Next.js, Railway) follow the text color so they work in dark mode. */
function BrandLogo({ icon }: { icon: SimpleIcon }) {
    const dark = parseInt(icon.hex, 16) < 0x222222;
    return (
        <svg role="img" aria-label={icon.title} viewBox="0 0 24 24" className="size-5 shrink-0" fill={dark ? "currentColor" : `#${icon.hex}`}>
            <path d={icon.path} />
        </svg>
    );
}

export function ToolGrid() {
    return (
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
            <p className="mb-8 text-center text-[11px] font-medium tracking-[0.12em] text-foreground/60">WORKS WITH YOUR WHOLE STACK</p>
            <Reveal>
                <div className="grid grid-cols-2 sm:grid-cols-5">
                    {TOOLS.map((t, i) => (
                        <div
                            key={t.name}
                            className={cn(
                                "flex h-20 items-center justify-center gap-2.5 border-foreground/10 text-[15px] font-medium text-foreground/75",
                                i % 5 !== 4 && "sm:border-r",
                                i % 2 === 0 && "max-sm:border-r",
                                i < 5 && "sm:border-b",
                                i < 8 && "max-sm:border-b"
                            )}
                        >
                            <BrandLogo icon={t.icon} />
                            {t.name}
                        </div>
                    ))}
                </div>
            </Reveal>
        </section>
    );
}

/* ── Statement: words light up as you scroll; key phrases colored ────────── */

type Piece = string | { text: string; color: string; icon: React.ElementType; chip: string };

const STATEMENT: Piece[] = [
    "We help development teams",
    { text: "share secrets safely", color: "text-[oklch(0.55_0.15_285)] dark:text-[oklch(0.8_0.1_285)]", icon: Lock, chip: "bg-pastel-lavender text-pastel-lavender-fg" },
    "across every environment,",
    { text: "control who can change them", color: "text-[oklch(0.66_0.15_55)] dark:text-[oklch(0.82_0.11_60)]", icon: Users, chip: "bg-pastel-peach text-pastel-peach-fg" },
    "and",
    { text: "ship faster", color: "text-[oklch(0.58_0.13_235)] dark:text-[oklch(0.82_0.09_235)]", icon: Zap, chip: "bg-pastel-sky text-pastel-sky-fg" },
    "without pasting .env files into chat ever again.",
];

export function Statement() {
    const { ref, progress } = useScrollProgress<HTMLParagraphElement>();
    const words = STATEMENT.flatMap((p) =>
        typeof p === "string" ? p.split(" ").map((w) => ({ w, piece: null as null | Exclude<Piece, string> })) : [{ w: "", piece: p }]
    );
    const lit = progress * words.length * 1.15;

    return (
        <section className="mx-auto max-w-6xl px-4 py-32 sm:px-6">
            <p
                ref={ref}
                className="mx-auto max-w-3xl text-[1.7rem] font-normal leading-[1.25] tracking-[-0.025em] sm:text-[2.4rem]"
            >
                <ArrowRight className="mr-2 inline size-7 -translate-y-0.5 sm:size-9" />
                {words.map((item, i) => {
                    const on = i < lit;
                    if (item.piece) {
                        const P = item.piece;
                        return (
                            <span key={i} className={cn("transition-opacity duration-300", on ? "opacity-100" : "opacity-30")}>
                                <span className={P.color}>{P.text}</span>{" "}
                                <span className={cn("inline-flex size-7 -translate-y-1 items-center justify-center rounded-md align-middle sm:size-8", P.chip)}>
                                    <P.icon className="size-4" />
                                </span>{" "}
                            </span>
                        );
                    }
                    return (
                        <Fragment key={i}>
                            <span className={cn("transition-colors duration-300", on ? "text-foreground" : "text-foreground/25")}>{item.w}</span>{" "}
                        </Fragment>
                    );
                })}
            </p>
        </section>
    );
}

/* ── Outcomes accordion: stacked colored bars, one open at a time ────────── */

const OUTCOMES = [
    {
        title: "Organizations and teams",
        body: (
            <>
                Group projects <Em>by team</Em>. Every project gets <Em>development, staging and production</Em>, each with its own values.
            </>
        ),
        bg: "bg-[oklch(0.84_0.12_70)] dark:bg-[oklch(0.42_0.08_65)]",
    },
    {
        title: "Editors and viewers",
        body: (
            <>
                Give each person <Em>edit or read-only access</Em> per team. Admins see everything; everyone else sees <Em>only their teams</Em>.
            </>
        ),
        bg: "bg-[oklch(0.84_0.09_230)] dark:bg-[oklch(0.4_0.07_235)]",
    },
    {
        title: "Two-factor and encryption",
        body: (
            <>
                Every sign-in is confirmed with an <Em>authenticator code</Em>. Values are <Em>encrypted with AES-256-GCM</Em> at rest.
            </>
        ),
        bg: "bg-[oklch(0.8_0.1_290)] dark:bg-[oklch(0.4_0.08_290)]",
    },
    {
        title: "Audit log and tokens",
        body: (
            <>
                See <Em>who changed which keys</Em>, never the values. Personal API tokens <Em>follow each person&apos;s current access</Em>.
            </>
        ),
        bg: "bg-[oklch(0.84_0.09_330)] dark:bg-[oklch(0.4_0.08_330)]",
    },
];

export function Outcomes() {
    const [open, setOpen] = useState(0);
    const [paused, setPaused] = useState(false);
    const { ref, inView } = useInView<HTMLDivElement>(0.3);
    useEffect(() => {
        if (!inView || paused) return;
        const t = setTimeout(() => setOpen((o) => (o + 1) % OUTCOMES.length), 5000);
        return () => clearTimeout(t);
    }, [open, inView, paused]);

    return (
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-32 sm:px-6">
            <div className="mb-14 flex items-start justify-between gap-6">
                <h2 className="text-4xl font-normal leading-[1.05] tracking-[-0.04em] sm:text-6xl">
                    Everything your
                    <br />
                    team needs
                </h2>
                <p className="hidden pt-3 text-[11px] font-medium tracking-[0.12em] text-foreground/60 sm:block">WHAT ENVOY DOES</p>
            </div>
            <div ref={ref} className="flex flex-col gap-1.5" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                {OUTCOMES.map((o, i) => {
                    const on = i === open;
                    return (
                        <button
                            key={o.title}
                            type="button"
                            onClick={() => setOpen(i)}
                            aria-expanded={on}
                            className={cn(
                                "grid w-full overflow-hidden rounded-lg text-left text-black/80 outline-none transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-2 focus-visible:ring-foreground/40 dark:text-white/90",
                                o.bg,
                                on ? "grid-rows-[auto_1fr]" : "grid-rows-[auto_0fr]"
                            )}
                        >
                            <span className="flex items-baseline justify-between gap-4 px-5 py-4 sm:px-6">
                                <span className="text-[15px] font-medium">{o.title}</span>
                                <span className="text-[12px] tabular-nums opacity-60">0{i + 1}</span>
                            </span>
                            <span className="min-h-0 overflow-hidden">
                                <span className="block max-w-md px-5 pb-6 pt-8 text-[14px] leading-relaxed opacity-90 sm:px-6">{o.body}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

/* ── Use cases: pastel tiles with a caption below each ───────────────────── */

function Snippet({ lines }: { lines: [string, string][] }) {
    return (
        <div className="w-[78%] rounded-lg bg-white/85 p-3 font-mono text-[11px] leading-5 text-black/75 dark:bg-black/40 dark:text-white/80">
            {lines.map(([k, v]) => (
                <p key={k} className="flex justify-between gap-3">
                    <span className="truncate">{k}</span>
                    <span className="text-black/40 dark:text-white/40">{v}</span>
                </p>
            ))}
        </div>
    );
}

const CASES = [
    {
        caption: (
            <>
                <Em>Contractors</Em> got <Em>read-only access</Em> to staging, and nothing else
            </>
        ),
        tag: "VIEWER ROLE",
        shape: "bg-[oklch(0.94_0.03_250)] dark:bg-[oklch(0.26_0.03_250)]",
        visual: <Snippet lines={[["API_BASE", "••••"], ["SENTRY_DSN", "••••"], ["Role", "Viewer"]]} />,
    },
    {
        caption: (
            <>
                <Em>CI pulls</Em> production values with a <Em>scoped personal token</Em>
            </>
        ),
        tag: "API TOKENS",
        shape: "bg-[oklch(0.94_0.08_100)] dark:bg-[oklch(0.32_0.05_95)]",
        visual: <Snippet lines={[["$ curl …/production", "200"], ["DATABASE_URL", "••••"], ["REDIS_URL", "••••"]]} />,
    },
    {
        caption: (
            <>
                <Em>Every change</Em> shows up in the audit log, <Em>without the values</Em>
            </>
        ),
        tag: "AUDIT LOG",
        shape: "bg-[oklch(0.94_0.025_250)] dark:bg-[oklch(0.25_0.025_250)]",
        visual: <Snippet lines={[["priya changed", "2 keys"], ["leo added", "SAM"], ["ana revoked", "token"]]} />,
    },
    {
        caption: (
            <>
                <Em>A one-off .env</Em> shared with a link that <Em>expires in an hour</Em>
            </>
        ),
        tag: "TEMPORARY LINK",
        shape: "bg-[oklch(0.86_0.08_230)] dark:bg-[oklch(0.34_0.06_235)]",
        visual: <Snippet lines={[["Expires in", "1h"], ["Variables", "6"], ["Encrypted", "yes"]]} />,
    },
];

export function UseCases() {
    return (
        <section className="mx-auto max-w-6xl px-4 pb-32 sm:px-6">
            <div className="mb-14 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <h2 className="text-4xl font-normal leading-[1.05] tracking-[-0.04em] sm:text-6xl">
                    Secrets,
                    <br />
                    handled properly
                </h2>
                <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
                    <p className="max-w-[16rem] text-[13px] text-foreground/70">How teams keep their environment variables <Em>out of chat</Em> and <Em>in one place</Em>.</p>
                    <Button asChild size="sm">
                        <Link href="/signup">Create an organization</Link>
                    </Button>
                </div>
            </div>
            {/* An aligned 2×2 grid: tiles and captions line up across each row. */}
            <div className="grid gap-x-10 gap-y-16 sm:grid-cols-2">
                {CASES.map((c, i) => (
                    <Reveal key={c.tag} delay={(i % 2) * 100} className="flex flex-col">
                        <div className={cn("flex h-64 items-center justify-center rounded-lg", c.shape)}>{c.visual}</div>
                        <p className="mt-5 flex gap-2 text-[15px] leading-snug text-foreground/70">
                            <ArrowRight className="mt-1 size-3.5 shrink-0" />
                            <span>{c.caption}</span>
                        </p>
                        <p className="mt-2 text-[10px] font-medium tracking-[0.12em] text-foreground/50 underline underline-offset-4">{c.tag}</p>
                    </Reveal>
                ))}
            </div>
        </section>
    );
}

