"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/app/states";

/** Unexpected errors inside the signed-in app: shown in place of the page, keeping the sidebar and top bar. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState title="Something went wrong" onRetry={reset} reference={error.digest}>
            This page hit an <strong className="font-semibold text-foreground">unexpected error</strong>. Nothing was changed. Try again, and if it
            keeps happening, let us know.
        </ErrorState>
    );
}
