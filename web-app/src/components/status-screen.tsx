"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { GlassPanes, PASTEL_FIELD } from "@/components/landing/glass-panes";
import { cn } from "@/lib/utils";

/**
 * Full-page status screen (404, unexpected errors) in the landing page's look: pastel field with frosted
 * glass panes, a large status code and a short explanation with a way forward.
 */
export function StatusScreen({
    code,
    title,
    children,
    onRetry,
    reference,
}: {
    code: string;
    title: string;
    children: React.ReactNode;
    /** Shows "Try again" (for errors that may be temporary). */
    onRetry?: () => void;
    /** Error reference to quote when reporting the problem. */
    reference?: string;
}) {
    return (
        <div className={cn("relative flex min-h-dvh flex-col overflow-hidden", PASTEL_FIELD)}>
            <GlassPanes cols={6} aspect={1.6} className="h-[75%]" />

            <header className="relative px-6 py-5 sm:px-10">
                <Link href="/" aria-label="Envoy home" className="inline-flex">
                    <Logo />
                </Link>
            </header>

            <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center sm:px-10">
                <p aria-hidden className="text-[7rem] font-normal leading-none tracking-[-0.06em] text-foreground/90 sm:text-[11rem]">
                    {code}
                </p>
                <h1 className="mt-4 text-2xl font-normal tracking-[-0.03em] text-foreground sm:text-4xl">{title}</h1>
                <div className="mt-3 max-w-md text-[15px] leading-relaxed text-foreground/70">{children}</div>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {onRetry && (
                        <Button onClick={onRetry}>
                            <RotateCcw /> Try again
                        </Button>
                    )}
                    <Button asChild variant={onRetry ? "outline" : "default"}>
                        <Link href="/">
                            <ArrowLeft /> Go home
                        </Link>
                    </Button>
                    <Button asChild variant="ghost">
                        <Link href="/dashboard">Open dashboard</Link>
                    </Button>
                </div>
                {reference && (
                    <p className="mt-8 text-[12.5px] text-foreground/55">
                        If this keeps happening, report it with reference <span className="select-all font-mono text-foreground/80">{reference}</span>.
                    </p>
                )}
            </main>
        </div>
    );
}
