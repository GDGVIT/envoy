"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudAlert, RotateCcw, SearchX, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "./app-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Centred icon, title, explanation and actions: every not-found, expired and error state uses this. */
export function StateBlock({
    icon: Icon,
    tone,
    title,
    children,
    actions,
    contained = true,
}: {
    icon: React.ElementType;
    tone: string;
    title: string;
    children: React.ReactNode;
    actions: React.ReactNode;
    /** Wrap in the app's page container (off for pages outside the app shell). */
    contained?: boolean;
}) {
    const block = (
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
            <span className={`flex size-11 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="size-5" />
            </span>
            <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
        </div>
    );
    return contained ? <PageContainer>{block}</PageContainer> : block;
}

/** Something that doesn't exist, or that you can't see (the API returns 404 for both). */
export function NotFoundState({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
        <StateBlock
            icon={SearchX}
            tone="bg-pastel-sky text-pastel-sky-fg"
            title={title}
            actions={
                <Button asChild variant="outline">
                    <Link href="/dashboard">Go to your organization</Link>
                </Button>
            }
        >
            {children ?? (
                <>
                    It may have been <strong className="font-semibold text-foreground">deleted or renamed</strong>, or you may not have access to it.
                </>
            )}
        </StateBlock>
    );
}

/** A load or render failure that may be temporary (server error, lost connection). */
export function ErrorState({
    title = "Couldn't load this page",
    children,
    onRetry,
    reference,
}: {
    title?: string;
    children?: React.ReactNode;
    onRetry?: () => void;
    reference?: string;
}) {
    return (
        <StateBlock
            icon={CloudAlert}
            tone="bg-pastel-rose text-pastel-rose-fg"
            title={title}
            actions={
                <>
                    {onRetry && (
                        <Button onClick={onRetry}>
                            <RotateCcw /> Try again
                        </Button>
                    )}
                    <Button asChild variant="outline">
                        <Link href="/dashboard">Go to your organization</Link>
                    </Button>
                </>
            }
        >
            {children ?? (
                <>
                    Something went wrong on our side or with your connection. <strong className="font-semibold text-foreground">Nothing was changed.</strong>
                </>
            )}
            {reference && (
                <p className="mt-3 text-xs">
                    Reference <span className="select-all font-mono text-foreground/80">{reference}</span>
                </p>
            )}
        </StateBlock>
    );
}

/** The organization requires two-factor and this person hasn't set it up. */
export function Requires2faState({ message }: { message?: string }) {
    const back = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/dashboard";
    return (
        <StateBlock
            icon={ShieldCheck}
            tone="bg-pastel-lavender text-pastel-lavender-fg"
            title="Two-factor authentication required"
            actions={
                <>
                    <Button asChild>
                        <Link href={`/2fa/setup?callbackUrl=${encodeURIComponent(back)}`}>Set up two-factor</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/account">Account settings</Link>
                    </Button>
                </>
            }
        >
            {message ?? "This organization requires two-factor authentication."} It takes a minute: a{" "}
            <strong className="font-semibold text-foreground">passkey</strong> is the quickest.
        </StateBlock>
    );
}

/**
 * Picks the right state for a failed load: two-factor required, "not found" for 404s, or a retryable
 * error for anything else.
 */
export function LoadError({ error, notFoundTitle, onRetry }: { error: unknown; notFoundTitle: string; onRetry?: () => void }) {
    const status = (error as { status?: number } | null)?.status;
    if ((error as { code?: string } | null)?.code === "org_requires_2fa") return <Requires2faState message={(error as Error).message} />;
    if (status === 404 || status === 403) return <NotFoundState title={notFoundTitle} />;
    return <ErrorState onRetry={onRetry} />;
}

export function LoadingPage() {
    return (
        <PageContainer>
            <Skeleton className="mb-3 h-4 w-40" />
            <Skeleton className="mb-10 h-8 w-64" />
            <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                ))}
            </div>
        </PageContainer>
    );
}

/** Shown after signing in with a backup code when few remain. */
export function LowBackupCodesBanner() {
    const [remaining, setRemaining] = useState<number | null>(null);
    useEffect(() => {
        const v = sessionStorage.getItem("envoy:lowBackupCodes");
        if (v !== null) setRemaining(Number(v));
    }, []);
    if (remaining === null) return null;
    return (
        <Alert className="mb-8">
            <ShieldAlert />
            <AlertTitle>
                You have {remaining} backup code{remaining === 1 ? "" : "s"} left
            </AlertTitle>
            <AlertDescription>
                <Link href="/account#two-factor" className="underline underline-offset-4">
                    Generate new codes
                </Link>{" "}
                so you don&apos;t get locked out.
            </AlertDescription>
            <AlertAction>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Dismiss"
                    onClick={() => {
                        sessionStorage.removeItem("envoy:lowBackupCodes");
                        setRemaining(null);
                    }}
                >
                    <X />
                </Button>
            </AlertAction>
        </Alert>
    );
}
