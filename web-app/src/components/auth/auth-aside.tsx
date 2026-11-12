"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { GlassPanes, PASTEL_FIELD } from "@/components/landing/glass-panes";
import { cn } from "@/lib/utils";

const Em = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>;

/** The new-account path. Screens on it show where the person is. */
const STEPS = ["Create your account", "Turn on two-factor", "Set up your organization"];

type Panel = { title: string; body: React.ReactNode; step?: number; card?: "vars" | "code" };

function panelFor(path: string): Panel {
    if (path.startsWith("/signup")) {
        return {
            title: "Keep every secret in the right hands",
            body: (
                <>
                    Store your team&apos;s environment variables <Em>encrypted</Em>, organized by <Em>team and project</Em>.
                </>
            ),
            step: 0,
        };
    }
    if (path.startsWith("/2fa/setup")) {
        return {
            title: "One more lock on the door",
            body: (
                <>
                    Every sign-in to Envoy is confirmed with a <Em>code from your phone</Em>, so a leaked password alone <Em>can&apos;t open your secrets</Em>.
                </>
            ),
            step: 1,
        };
    }
    if (path.startsWith("/onboarding")) {
        return {
            title: "Give your team a home",
            body: (
                <>
                    An organization holds your <Em>teams, projects and environments</Em>. Invite people once and choose <Em>who can edit</Em>.
                </>
            ),
            step: 2,
        };
    }
    if (path.startsWith("/2fa/verify")) {
        return {
            title: "Confirm it's you",
            body: (
                <>
                    Codes change every <Em>30 seconds</Em>. Lost your phone? Use one of your <Em>backup codes</Em>.
                </>
            ),
            card: "code",
        };
    }
    if (path.startsWith("/invite")) {
        return {
            title: "Your team is waiting",
            body: (
                <>
                    Accept the invite to see the <Em>projects shared with you</Em>, with the access your admin chose.
                </>
            ),
        };
    }
    return {
        title: "Welcome back",
        body: (
            <>
                Sign in, confirm with your <Em>authenticator code</Em>, and pick up where your team left off.
            </>
        ),
        card: "vars",
    };
}

function GlassCard({ rows }: { rows: [string, React.ReactNode][] }) {
    return (
        <div className="w-full max-w-xs rounded-lg border border-white/70 bg-white/55 p-4 font-mono text-[12px] leading-6 text-foreground/80 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]">
            {rows.map(([k, v]) => (
                <p key={k} className="flex justify-between gap-4">
                    <span className="truncate">{k}</span>
                    <span className="text-foreground/45">{v}</span>
                </p>
            ))}
        </div>
    );
}

const CARDS = {
    vars: (
        <GlassCard
            rows={[
                ["DATABASE_URL", "••••••••"],
                ["STRIPE_SECRET", "••••••••"],
                ["NEXT_PUBLIC_URL", "••••••••"],
            ]}
        />
    ),
    code: (
        <GlassCard
            rows={[
                ["Authenticator", "482 913"],
                ["Expires in", "30s"],
                ["Backup codes", "10 left"],
            ]}
        />
    ),
};

function Steps({ current }: { current: number }) {
    return (
        <ol className="flex flex-col gap-3">
            {STEPS.map((label, i) => {
                const done = i < current;
                const on = i === current;
                return (
                    <li key={label} className={cn("flex items-center gap-3 text-sm", on ? "text-foreground" : "text-foreground/50")}>
                        <span
                            className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-medium tabular-nums",
                                done && "bg-primary text-primary-foreground",
                                on && "bg-foreground text-background",
                                !done && !on && "bg-foreground/[0.06]"
                            )}
                        >
                            {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span className={cn(on && "font-medium")}>{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}

/** Left half of every auth and onboarding screen. Hidden below lg, where the form takes the full width. */
export function AuthAside() {
    const panel = panelFor(usePathname() ?? "/login");
    return (
        <aside className={cn("relative m-2 hidden overflow-hidden rounded-lg lg:flex lg:flex-col", PASTEL_FIELD)}>
            <GlassPanes cols={4} aspect={1.15} className="h-[70%]" />
            <div className="relative p-8">
                <Link href="/" aria-label="Envoy home" className="inline-flex">
                    <Logo />
                </Link>
            </div>
            <div className="relative mt-auto flex flex-col gap-8 p-10">
                {panel.card && CARDS[panel.card]}
                <div>
                    <h2 className="max-w-md text-[2.5rem] font-normal leading-[1.05] tracking-[-0.04em] text-foreground">{panel.title}</h2>
                    <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-foreground/70">{panel.body}</p>
                </div>
                {panel.step !== undefined && <Steps current={panel.step} />}
            </div>
        </aside>
    );
}
