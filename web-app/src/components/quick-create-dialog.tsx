"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

export type QuickCreateDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Small line above the name, e.g. "New team" or "Rename production". Also the dialog's accessible title. */
    eyebrow: string;
    /** Placeholder for the large name field, e.g. "Team name". */
    namePlaceholder: string;
    initialName?: string;
    nameMaxLength?: number;
    /** Show the optional description field. */
    description?: { placeholder: string; initial?: string; maxLength?: number };
    /** Show the slug the name will get, e.g. "/t/" renders "/t/backend". */
    slugPrefix?: string;
    /** Footer text shown when there is no slug chip, e.g. an example of valid names. */
    hint?: React.ReactNode;
    submitLabel: string;
    /** Throw to show the error in the dialog; resolve to close it. */
    onSubmit: (name: string, description: string) => Promise<void>;
};

/**
 * Spotlight-style dialog for creating or renaming something from a name (and an optional
 * description): a large unlabeled name field, a slug chip and keyboard hints.
 * Enter submits; Shift+Enter adds a line in the description; Esc cancels.
 */
export function QuickCreateDialog(props: QuickCreateDialogProps) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                <DialogTitle className="sr-only">{props.eyebrow}</DialogTitle>
                {/* Rendered only while open, so the fields reset each time the dialog opens. */}
                <QuickCreateForm {...props} />
            </DialogContent>
        </Dialog>
    );
}

function QuickCreateForm({
    onOpenChange,
    eyebrow,
    namePlaceholder,
    initialName = "",
    nameMaxLength = 64,
    description,
    slugPrefix,
    hint,
    submitLabel,
    onSubmit,
}: QuickCreateDialogProps) {
    const [name, setName] = useState(initialName);
    const [desc, setDesc] = useState(description?.initial ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ready = name.trim().length > 0 && !busy;

    async function submit() {
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
            await onSubmit(name.trim(), desc.trim());
            onOpenChange(false);
        } catch (e: any) {
            setError(e?.message ?? "Something went wrong.");
            setBusy(false);
        }
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            <div className="flex flex-col gap-1 px-6 pb-4 pt-6">
                <p className="text-[12px] font-medium text-muted-foreground">{eyebrow}</p>
                <input
                    aria-label={namePlaceholder}
                    autoFocus
                    required
                    maxLength={nameMaxLength}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={namePlaceholder}
                    className="w-full bg-transparent text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground/50"
                />
                {description && (
                    <textarea
                        aria-label="Description"
                        rows={2}
                        maxLength={description.maxLength ?? 280}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        placeholder={description.placeholder}
                        className="mt-1 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
                    />
                )}
                {error && (
                    <p role="alert" className="mt-2 text-[13px] text-destructive">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2 border-t px-4 py-3">
                {slugPrefix ? (
                    <span className="min-w-0 truncate rounded-md bg-muted px-2 py-1 font-mono text-[12px] text-muted-foreground">
                        {slugPrefix}
                        <span className={cn(name.trim() && "text-foreground")}>{name.trim() ? slugify(name) : "…"}</span>
                    </span>
                ) : hint ? (
                    <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">{hint}</span>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <DialogCancel onClick={() => onOpenChange(false)} />
                    <DialogSubmit loading={busy} disabled={!ready}>
                        {submitLabel}
                    </DialogSubmit>
                </div>
            </div>
        </form>
    );
}
