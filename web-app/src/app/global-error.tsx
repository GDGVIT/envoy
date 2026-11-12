"use client";

import "./globals.css";
import { useEffect } from "react";

/**
 * Last resort: an error in the root layout itself, so nothing else (fonts, theme, providers) can be
 * relied on. Plain and self-contained.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="en">
            <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground">
                <main className="max-w-md">
                    <p className="text-sm font-medium text-muted-foreground">Envoy</p>
                    <h1 className="mt-2 text-3xl font-normal tracking-[-0.03em]">Something went wrong</h1>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                        Envoy couldn&apos;t load. Your data is safe. Try again in a moment.
                    </p>
                    <div className="mt-6 flex gap-2">
                        <button
                            type="button"
                            onClick={reset}
                            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Try again
                        </button>
                        {/* A full page load on purpose: the root layout itself failed, so client-side navigation can't be trusted. */}
                        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                        <a href="/" className="inline-flex h-9 items-center rounded-lg bg-muted px-4 text-sm font-medium hover:bg-muted/70">
                            Go home
                        </a>
                    </div>
                    {error.digest && (
                        <p className="mt-6 text-xs text-muted-foreground">
                            Reference <span className="select-all font-mono">{error.digest}</span>
                        </p>
                    )}
                </main>
            </body>
        </html>
    );
}
