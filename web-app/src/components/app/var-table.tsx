"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { parseDotenv, type EnvVar } from "@/lib/dotenv";
import { cn } from "@/lib/utils";

/*
 * The spreadsheet-style variables table, shared by the project editor and the temporary link page:
 * numbered rows, KEY | VALUE cells, masked values with per-row reveal/copy/delete, "Add variable",
 * and the "Import from .env" dialog.
 */

export const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
export const MASK = "••••••••••••";

/** Spreadsheet-style cell: no border, fill or ring. The row highlights while a cell in it has focus. */
export const cellInput =
    "h-10 rounded-none border-0 bg-transparent px-3 font-mono text-[13px] hover:bg-transparent focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent dark:hover:bg-transparent dark:focus-visible:bg-transparent";

/** Width of the per-row actions (three icon buttons), shared by the header so columns line up. */
export const ACTIONS_W = "w-[6.75rem]";
/** Key column width, shared by the header and the rows. */
export const KEY_COL = "sm:w-[34%] sm:max-w-[360px] sm:shrink-0";

/**
 * One editable row. `value` is null when the server hasn't sent it (values are locked); `origKey` is
 * the key the row was loaded with, so a hidden value can be kept through a rename (null for new rows).
 */
export type Row = { id: string; key: string; value: string | null; origKey: string | null };

let rowSeq = 0;
export const nextRowId = () => `r${++rowSeq}`;

export function IconAction({
    label,
    onClick,
    children,
    danger,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    onClick={onClick}
                    className={cn("text-muted-foreground", danger && "hover:bg-destructive/10 hover:text-destructive")}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function PasteDialog({
    open,
    onOpenChange,
    existingKeys,
    onApply,
    description = "Paste the contents of a .env file. Existing keys are overwritten. Nothing is saved until you click Save.",
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    description?: string;
    existingKeys: Set<string>;
    onApply: (vars: EnvVar[]) => void;
}) {
    const [text, setText] = useState("");
    useEffect(() => {
        if (!open) return;
        setText("");
        navigator.clipboard
            ?.readText()
            .then((t) => {
                if (t && /^\s*(export\s+)?[A-Za-z_][A-Za-z0-9_.-]*\s*=/m.test(t)) setText(t);
            })
            .catch(() => {});
    }, [open]);

    const parsed = useMemo(() => parseDotenv(text), [text]);
    const updates = parsed.filter((v) => existingKeys.has(v.key)).length;
    const invalid = parsed.filter((v) => !KEY_RE.test(v.key)).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form
                    className="contents"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!parsed.length) return;
                        onApply(parsed);
                        onOpenChange(false);
                    }}
                >
                <DialogHeader>
                    <DialogTitle>Import from .env</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    autoFocus
                    rows={10}
                    spellCheck={false}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        // Enter adds a line; ⌘/Ctrl+Enter imports.
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                        }
                    }}
                    placeholder={"DATABASE_URL=postgres://…\nREDIS_URL=redis://…"}
                    className="max-h-80 font-mono text-[12.5px]"
                />
                <p className="text-[13px] text-muted-foreground" aria-live="polite">
                    {parsed.length
                        ? `${parsed.length - updates} new, ${updates} updated${invalid ? `, ${invalid} with invalid names` : ""}.`
                        : "No variables detected yet."}
                </p>
                <DialogFooter>
                    <DialogCancel onClick={() => onOpenChange(false)} />
                    <DialogSubmit hint="⌘↵" disabled={!parsed.length}>
                        Import {parsed.length || ""} variable{parsed.length === 1 ? "" : "s"}
                    </DialogSubmit>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function ValueCell({
    row,
    editable,
    revealed,
    onChange,
    onUnlock,
    invalid,
}: {
    row: Row;
    editable: boolean;
    revealed: boolean;
    onChange: (value: string) => void;
    onUnlock: () => void;
    invalid?: boolean;
}) {
    const [focused, setFocused] = useState(false);

    // The server hasn't sent this value: it's locked until the user confirms an authenticator code.
    if (row.value === null) {
        return (
            <button
                type="button"
                onClick={onUnlock}
                title="Confirm your authenticator code to see or edit this value"
                aria-label={`Unlock to see ${row.key || "this value"}`}
                className="min-w-0 flex-1 truncate px-3 text-left font-mono text-[13px] leading-10 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
            >
                {MASK}
            </button>
        );
    }

    const value = row.value;
    const show = revealed || focused;
    const multiline = value.includes("\n");

    if (!editable) {
        return (
            <div
                className={cn(
                    "min-w-0 flex-1 truncate px-3 font-mono text-[13px] leading-10",
                    show ? "text-foreground" : "select-none text-muted-foreground"
                )}
            >
                {show ? value || <span className="italic text-muted-foreground">empty</span> : MASK}
            </div>
        );
    }

    const shared = {
        value: show ? value : value ? MASK : "",
        readOnly: !show,
        spellCheck: false,
        autoComplete: "off",
        placeholder: "value",
        "aria-label": `Value for ${row.key || "new variable"}`,
        "aria-invalid": invalid || undefined,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => show && onChange(e.target.value),
    };

    return multiline && show ? (
        <Textarea
            {...shared}
            rows={Math.min(8, value.split("\n").length)}
            className={cn(cellInput, "h-auto min-h-0 flex-1 py-2 leading-5")}
        />
    ) : (
        <Input {...shared} className={cn(cellInput, "min-w-0 flex-1", !show && "text-muted-foreground")} />
    );
}


/** Duplicate and invalid keys, and values without a key: what has to be fixed before saving. */
export function useRowProblems(rows: Row[]) {
    const keyCounts = useMemo(() => {
        const m = new Map<string, number>();
        rows.forEach((r) => r.key.trim() && m.set(r.key.trim(), (m.get(r.key.trim()) ?? 0) + 1));
        return m;
    }, [rows]);
    const problems = rows.filter((r) => {
        const k = r.key.trim();
        return (k && (!KEY_RE.test(k) || (keyCounts.get(k) ?? 0) > 1)) || (!k && r.value);
    }).length;
    return { keyCounts, problems };
}

/** The bordered KEY | VALUE table with numbered rows and an "Add variable" row for editors. */
export function VarTable({
    rows,
    visible = rows,
    filter,
    canEdit,
    keyCounts,
    revealAll,
    revealed,
    isChanged,
    onUpdate,
    onRemove,
    onAdd,
    onToggleReveal,
    onCopy,
    onUnlock,
}: {
    rows: Row[];
    /** Rows left after filtering (defaults to all). */
    visible?: Row[];
    filter?: string;
    canEdit: boolean;
    keyCounts: Map<string, number>;
    revealAll: boolean;
    revealed: Set<string>;
    /** Marks the row's line number as changed. */
    isChanged?: (row: Row) => boolean;
    onUpdate: (id: string, patch: Partial<Row>) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
    onToggleReveal: (row: Row, reveal: boolean) => void;
    onCopy: (row: Row) => void;
    /** A locked (null) value was clicked. */
    onUnlock?: () => void;
}) {
    return (
        <div className="overflow-hidden rounded-lg border">
            <div aria-hidden className="hidden border-b bg-muted/40 text-[12px] font-medium text-muted-foreground sm:flex">
                <span className="w-10 shrink-0 border-r" />
                <div className="flex min-w-0 flex-1">
                    <span className={cn(KEY_COL, "px-3 py-2")}>Key</span>
                    <span className="border-l px-3 py-2">Value</span>
                </div>
                <span className={cn(ACTIONS_W, "shrink-0")} />
            </div>
            <ol className="divide-y">
                {visible.map((row) => {
                    const lineNo = rows.indexOf(row) + 1;
                    const k = row.key.trim();
                    const keyInvalid = !!k && !KEY_RE.test(k);
                    const dup = !!k && (keyCounts.get(k) ?? 0) > 1;
                    const isRevealed = revealAll || revealed.has(row.id);
                    const changed = canEdit && !!isChanged?.(row);
                    return (
                        <li key={row.id} className="group flex items-start bg-background transition-colors focus-within:bg-muted/50 hover:bg-muted/25">
                            <span
                                aria-hidden
                                className={cn(
                                    "w-10 shrink-0 select-none self-stretch border-r pr-2.5 text-right font-mono text-[11.5px] leading-10 tabular-nums",
                                    changed ? "border-r-2 border-r-primary text-foreground" : "text-muted-foreground/70"
                                )}
                            >
                                {lineNo}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-start">
                                <div className={KEY_COL}>
                                    {canEdit ? (
                                        <Input
                                            id={`key-${row.id}`}
                                            value={row.key}
                                            onChange={(e) => onUpdate(row.id, { key: e.target.value.replace(/\s/g, "_") })}
                                            placeholder="KEY"
                                            spellCheck={false}
                                            autoComplete="off"
                                            aria-label="Variable name"
                                            aria-invalid={keyInvalid || dup || undefined}
                                            title={dup ? "Duplicate key" : keyInvalid ? "Use letters, digits, _ . - and don't start with a digit" : undefined}
                                            className={cn(cellInput, "font-medium", (keyInvalid || dup) && "text-destructive")}
                                        />
                                    ) : (
                                        <div className="truncate px-3 font-mono text-[13px] font-medium leading-10">{row.key}</div>
                                    )}
                                </div>
                                {/* Column divider between key and value (stacked, without one, on small screens). */}
                                <span aria-hidden className="hidden w-px self-stretch bg-border sm:block" />
                                <ValueCell
                                    row={row}
                                    editable={canEdit}
                                    revealed={isRevealed}
                                    invalid={!k && !!row.value}
                                    onChange={(value) => onUpdate(row.id, { value })}
                                    onUnlock={() => onUnlock?.()}
                                />
                            </div>
                            <div className={cn(ACTIONS_W, "flex shrink-0 items-center justify-end gap-0.5 px-1 py-1 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100")}>
                                {!revealAll && (
                                    <IconAction label={isRevealed ? "Hide value" : "Reveal value"} onClick={() => onToggleReveal(row, !isRevealed)}>
                                        {isRevealed ? <EyeOff /> : <Eye />}
                                    </IconAction>
                                )}
                                <IconAction label="Copy value" onClick={() => onCopy(row)}>
                                    <Copy />
                                </IconAction>
                                {canEdit && (
                                    <IconAction label="Delete variable" danger onClick={() => onRemove(row.id)}>
                                        <Trash2 />
                                    </IconAction>
                                )}
                            </div>
                        </li>
                    );
                })}
                {visible.length === 0 && (
                    <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">No keys match &ldquo;{filter}&rdquo;.</li>
                )}
            </ol>
            {canEdit && (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onAdd}
                    className="h-10 w-full justify-start rounded-none border-t px-3 text-[13px] font-normal text-muted-foreground"
                >
                    <Plus /> Add variable
                </Button>
            )}
        </div>
    );
}
