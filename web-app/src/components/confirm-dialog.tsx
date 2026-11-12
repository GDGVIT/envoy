"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Confirmation for destructive actions (shadcn AlertDialog). Every deletion passes `confirmText`:
 * the exact text is shown highlighted, and the action stays disabled until it's typed exactly.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    actionLabel,
    cancelLabel = "Cancel",
    confirmText,
    onConfirm,
    danger = true,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    actionLabel: string;
    cancelLabel?: string;
    confirmText?: string;
    onConfirm: (typed: string) => Promise<unknown> | void;
    danger?: boolean;
}) {
    const [typed, setTyped] = React.useState("");
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (!open) setTyped("");
    }, [open]);

    const matched = !!confirmText && typed === confirmText;
    const blocked = !!confirmText && !matched;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <form
                    className="contents"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (blocked) return;
                        setBusy(true);
                        try {
                            await onConfirm(typed);
                            onOpenChange(false);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                        <AlertDialogDescription>{description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    {confirmText && (
                        <div className="flex flex-col gap-2.5">
                            <label htmlFor="confirm-input" className="text-[13px] leading-relaxed text-muted-foreground">
                                To confirm, type{" "}
                                {/* The exact text to type, highlighted and selectable in one click. */}
                                <span className="select-all rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono text-[12.5px] font-medium text-destructive">
                                    {confirmText}
                                </span>{" "}
                                below.
                            </label>
                            <Input
                                id="confirm-input"
                                autoFocus
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                aria-invalid={false}
                                className={cn("font-mono", matched && "border-destructive/50 bg-background ring-4 ring-destructive/10")}
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                            />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogPrimitive.Cancel asChild>
                            <DialogCancel>{cancelLabel}</DialogCancel>
                        </AlertDialogPrimitive.Cancel>
                        <DialogSubmit variant={danger ? "destructive" : "default"} disabled={blocked} loading={busy}>
                            {actionLabel}
                        </DialogSubmit>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
