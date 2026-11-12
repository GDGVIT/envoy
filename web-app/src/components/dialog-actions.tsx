"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * Footer buttons shared by every dialog (the look of the quick-create dialog): a quiet Cancel with an
 * Esc hint and the main action with an Enter hint. Put them in `DialogFooter` / `AlertDialogFooter`,
 * which render the bordered bar at the bottom of the dialog.
 *
 * The Enter hint must be true: `DialogSubmit` is a submit button, so it belongs inside a `<form>`
 * whose onSubmit runs the action.
 */
export function DialogCancel({ children = "Cancel", className, ...props }: React.ComponentProps<typeof Button>) {
    return (
        <Button type="button" variant="ghost" size="sm" className={cn("text-muted-foreground", className)} {...props}>
            {children} <Kbd>Esc</Kbd>
        </Button>
    );
}

const enterKbd: Record<string, string> = {
    // A disabled primary button turns muted grey, so the hint switches to the muted colours with it.
    default:
        "bg-primary-foreground/20 text-primary-foreground group-disabled/button:bg-foreground/10 group-disabled/button:text-muted-foreground",
    destructive: "bg-destructive/15 text-destructive",
};

/** `hint` overrides the key shown, e.g. "⌘↵" when Enter alone adds a line in a textarea. */
export function DialogSubmit({
    children,
    variant = "default",
    hint = "↵",
    className,
    ...props
}: React.ComponentProps<typeof Button> & { hint?: string }) {
    return (
        <Button type="submit" size="sm" variant={variant} className={className} {...props}>
            {children} <Kbd className={cn(enterKbd[variant ?? "default"])}>{hint}</Kbd>
        </Button>
    );
}
