"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/status-screen";

/** Unexpected errors in a page outside the signed-in app (landing, sign-in, share links). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <StatusScreen code="500" title="Something went wrong" onRetry={reset} reference={error.digest}>
            This page hit an <strong className="font-semibold text-foreground">unexpected error</strong>. Your data is safe. Try again, and if it
            keeps happening, let us know.
        </StatusScreen>
    );
}
