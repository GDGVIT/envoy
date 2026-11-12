"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ClipboardPaste, Copy, Download, Eye, EyeOff, Fingerprint, LockKeyhole, LockOpen, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { EmptyState, SearchInput, copyText } from "@/components/common";
import { OtpField } from "@/components/otp-field";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { PasteDialog, VarTable, nextRowId, useRowProblems, type Row } from "@/components/app/var-table";
import { ApiError, api, fetcher } from "@/lib/api-client";
import { confirmWithPasskey, passkeyError, passkeysSupported } from "@/lib/passkey-client";
import { stringifyDotenv, type EnvVar } from "@/lib/dotenv";
import { cn } from "@/lib/utils";

const FILTER_ID = "env-filter";

/** A stored value the server hasn't sent (values are locked): `null`. */
type StoredVar = { key: string; value: string | null };
const toRows = (vars: StoredVar[]): Row[] => vars.map((v) => ({ id: nextRowId(), key: v.key, value: v.value, origKey: v.key }));
/** Only rows whose values are known (for copy, download and the conflict fallback). */
const knownVars = (rows: Row[]): EnvVar[] =>
    rows.filter((r) => r.key.trim() && r.value !== null).map((r) => ({ key: r.key.trim(), value: r.value as string }));

function diffCount(baseline: StoredVar[], rows: Row[]) {
    const before = new Map(baseline.map((v) => [v.key, v.value]));
    const kept = new Set<string>();
    let n = 0;
    for (const r of rows) {
        const k = r.key.trim();
        if (!k) {
            if (r.value) n++; // a value without a key yet is a pending change
            continue;
        }
        if (r.origKey !== null && before.has(r.origKey)) {
            kept.add(r.origKey);
            const renamed = k !== r.origKey;
            const edited = r.value !== null && r.value !== before.get(r.origKey);
            if (renamed || edited) n++;
        } else n++; // new row
    }
    for (const k of before.keys()) if (!kept.has(k)) n++; // removed
    return n;
}

/**
 * Asks for a fresh authenticator code before secret values are sent to the browser. The unlock lives on
 * the server (10 minutes, per account); nothing is kept in the browser.
 */
function UnlockDialog({
    open,
    onOpenChange,
    onUnlocked,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUnlocked: () => Promise<unknown>;
}) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { data: methods } = useSWR<{ totp: boolean; passkeys: number }>(open ? "/api/2fa/methods" : null, fetcher);
    const canPasskey = (methods?.passkeys ?? 0) > 0 && passkeysSupported();
    const hasTotp = !!methods?.totp;

    useEffect(() => {
        if (open) {
            setCode("");
            setError(null);
        }
    }, [open]);

    const done = async () => {
        await onUnlocked();
        onOpenChange(false);
    };

    const submit = async (value = code) => {
        if (value.length !== 6 || busy) return;
        setBusy(true);
        setError(null);
        try {
            await api("/api/2fa/reveal", { method: "POST", body: { code: value } });
            await done();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn't check the code. Try again.");
            setCode("");
        } finally {
            setBusy(false);
        }
    };

    const withPasskey = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await confirmWithPasskey("reveal");
            await done();
        } catch (e) {
            const message = passkeyError(e);
            if (message) setError(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted">
                        <LockKeyhole className="size-4" />
                    </div>
                    <DialogTitle>Unlock secret values</DialogTitle>
                    <DialogDescription>
                        {canPasskey ? (
                            <>
                                Confirm with your <strong className="font-medium text-foreground">passkey</strong>
                                {hasTotp ? " or a code from your authenticator app" : ""}.
                            </>
                        ) : (
                            <>
                                Enter the code from your <strong className="font-medium text-foreground">authenticator app</strong>.
                            </>
                        )}{" "}
                        Values stay unlocked for <strong className="font-medium text-foreground">10 minutes</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (hasTotp && code.length === 6) submit();
                        else if (canPasskey) withPasskey();
                    }}
                    className="flex flex-col gap-3"
                >
                    {canPasskey && (
                        <Button type="button" variant="outline" className="w-full" onClick={withPasskey} loading={busy && !code} autoFocus>
                            <Fingerprint /> Use passkey
                        </Button>
                    )}
                    {canPasskey && hasTotp && <p className="text-center text-[12px] text-muted-foreground">or enter a code</p>}
                    {(hasTotp || !methods) && <OtpField value={code} onChange={setCode} onComplete={submit} disabled={busy || !methods} invalid={!!error} />}
                    {error && (
                        <p role="alert" className="text-[13px] text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <DialogCancel onClick={() => onOpenChange(false)} />
                        {hasTotp || !methods ? (
                            <DialogSubmit loading={busy && !!code} disabled={code.length !== 6}>
                                Unlock
                            </DialogSubmit>
                        ) : (
                            <DialogSubmit loading={busy}>Use passkey</DialogSubmit>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export type EnvEditorProps = {
    apiBase: string;
    envName: string;
    envSlug: string;
    canEdit: boolean;
    /** Values are null while locked. */
    vars: StoredVar[];
    version: number;
    updatedBy: string | null;
    /** When the user's unlock ends (null while locked). Values are only sent while unlocked. */
    revealUntil: string | null;
    onSaved: () => void;
    /** Refetch this environment (after unlocking or locking, to get or drop values). */
    onReload: () => Promise<unknown>;
    onDirtyChange: (dirty: boolean) => void;
    /** False for people without 2FA: values come unlocked, with no code, timer or Lock button. */
    revealRequired?: boolean;
    /** Pre-fills the key filter (e.g. opened from a variable in the command menu). */
    initialFilter?: string;
};

export function EnvEditor({ apiBase, envName, envSlug, canEdit, vars, version, revealUntil, onSaved, onReload, onDirtyChange, initialFilter, revealRequired = true }: EnvEditorProps) {
    const [rows, setRows] = useState<Row[]>(() => toRows(vars));
    const [baseline, setBaseline] = useState<StoredVar[]>(vars);
    const [baseVersion, setBaseVersion] = useState(version);
    const [filter, setFilter] = useState(initialFilter ?? "");
    useEffect(() => {
        if (initialFilter) setFilter(initialFilter);
    }, [initialFilter]);
    const [revealAll, setRevealAll] = useState(false);
    const [revealed, setRevealed] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [conflict, setConflict] = useState<string | null>(null);
    const [pasteOpen, setPasteOpen] = useState(false);
    const [unlockOpen, setUnlockOpen] = useState(false);
    const focusRowId = useRef<string | null>(null);
    const rowsRef = useRef(rows);
    rowsRef.current = rows;

    // ── Unlock (server-side, 10 minutes): values arrive only after a fresh authenticator code.
    const timedUnlock = revealRequired && !!revealUntil && new Date(revealUntil).getTime() > Date.now();
    const unlocked = !revealRequired || timedUnlock;
    const pendingAction = useRef<(() => void) | null>(null);
    /** Runs `action` now if values are unlocked; otherwise asks for a code first and runs it afterwards. */
    const withValues = (action: () => void) => {
        if (unlocked) return action();
        pendingAction.current = action;
        setUnlockOpen(true);
    };

    // Reset only when the server version or environment changes (env switch, reload after
    // save/conflict). Keyed on version rather than the array so background revalidation
    // with identical data never wipes unsaved edits.
    const varsRef = useRef(vars);
    varsRef.current = vars;
    const baselineRef = useRef(baseline);
    baselineRef.current = baseline;

    // Values arrived or were dropped without a new version (unlock or expiry): merge them into the rows,
    // keeping any unsaved edits.
    useEffect(() => {
        const byKey = new Map(varsRef.current.map((v) => [v.key, v.value]));
        const previous = new Map(baselineRef.current.map((v) => [v.key, v.value]));
        setBaseline(varsRef.current);
        setRows((rs) =>
            rs.map((r) => {
                if (r.origKey === null || !byKey.has(r.origKey)) return r;
                const incoming = byKey.get(r.origKey)!;
                if (incoming !== null && r.value === null) return { ...r, value: incoming }; // just unlocked
                if (incoming === null && r.value !== null && r.value === previous.get(r.origKey)) {
                    return { ...r, value: null }; // locked again; unchanged value goes back to hidden
                }
                return r;
            })
        );
        if (!unlocked) {
            setRevealAll(false);
            setRevealed(new Set());
        } else if (pendingAction.current) {
            const run = pendingAction.current;
            pendingAction.current = null;
            setTimeout(run, 0); // after the merged rows are rendered
        }
    }, [unlocked]);

    // Keep the "N min left" note current.
    const [, tick] = useState(0);
    useEffect(() => {
        if (!unlocked) return;
        const t = setInterval(() => tick((n) => n + 1), 30_000);
        return () => clearInterval(t);
    }, [unlocked]);

    // Re-lock automatically when the unlock runs out.
    useEffect(() => {
        if (!revealUntil) return;
        const ms = new Date(revealUntil).getTime() - Date.now();
        if (ms <= 0) return;
        const t = setTimeout(() => onReload(), ms + 500);
        return () => clearTimeout(t);
    }, [revealUntil, onReload]);
    useEffect(() => {
        setRows(toRows(varsRef.current));
        setBaseline(varsRef.current);
        setBaseVersion(version);
        setConflict(null);
        setRevealed(new Set());
    }, [version, envSlug]);

    const changes = useMemo(() => diffCount(baseline, rows), [baseline, rows]);
    const dirty = changes > 0;
    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    const { keyCounts, problems } = useRowProblems(rows);

    const visible = rows.filter((r) => !filter || r.key.toLowerCase().includes(filter.toLowerCase()));

    const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const addRow = () => {
        const id = nextRowId();
        focusRowId.current = id;
        setFilter("");
        setRows((rs) => [...rs, { id, key: "", value: "", origKey: null }]);
    };

    useEffect(() => {
        if (focusRowId.current) {
            document.getElementById(`key-${focusRowId.current}`)?.focus();
            focusRowId.current = null;
        }
    }, [rows.length]);

    const save = useCallback(async () => {
        if (!dirty || saving) return;
        if (problems) {
            toast.error("Fix the highlighted rows before saving.");
            return;
        }
        setSaving(true);
        const named = rows.filter((r) => r.key.trim());
        // Rows whose value was never unlocked are sent without one: the server keeps the stored value.
        const payload = named.map((r) =>
            r.value !== null ? { key: r.key.trim(), value: r.value } : { key: r.key.trim(), from: r.origKey ?? r.key.trim() }
        );
        try {
            const res = await api<{ version: number; added: string[]; removed: string[]; changed: string[] }>(`${apiBase}/vars`, {
                method: "PUT",
                body: { vars: payload, version: baseVersion },
            });
            const saved = named.map((r) => ({ key: r.key.trim(), value: r.value }));
            setBaseline(saved);
            setRows(toRows(saved));
            setBaseVersion(res.version);
            const parts = [
                res.added.length && `${res.added.length} added`,
                res.changed.length && `${res.changed.length} changed`,
                res.removed.length && `${res.removed.length} removed`,
            ].filter(Boolean);
            toast.success(`Saved ${envName}`, { description: parts.join(", ") || undefined });
            onSaved();
        } catch (e) {
            if (e instanceof ApiError && e.code === "version_conflict") setConflict(e.message);
            else toast.error((e as Error).message);
        } finally {
            setSaving(false);
        }
    }, [apiBase, baseVersion, dirty, envName, onSaved, problems, rows, saving]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                if (!canEdit) return;
                e.preventDefault();
                save();
            } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                document.getElementById(FILTER_ID)?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [canEdit, save]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const currentVars = knownVars(rows);
    const minutesLeft = unlocked ? Math.max(1, Math.ceil((new Date(revealUntil!).getTime() - Date.now()) / 60000)) : 0;

    const lock = async () => {
        try {
            await api("/api/2fa/reveal", { method: "DELETE" });
        } finally {
            await onReload();
        }
    };

    // Where the editor sits horizontally, so the fixed save bar can centre on it (sidebar open or not).
    const rootRef = useRef<HTMLDivElement>(null);
    const [barBox, setBarBox] = useState<{ left: number; width: number } | null>(null);
    const showBar = canEdit && dirty;
    useEffect(() => {
        const el = rootRef.current;
        if (!showBar || !el) return;
        const measure = () => {
            const r = el.getBoundingClientRect();
            setBarBox((b) => (b && b.left === r.left && b.width === r.width ? b : { left: r.left, width: r.width }));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener("resize", measure);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [showBar]);

    const download = () => {
        const blob = new Blob([stringifyDotenv(knownVars(rowsRef.current))], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = envSlug === "development" ? ".env" : `.env.${envSlug}`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div ref={rootRef} className={cn(canEdit && dirty && "pb-20")}>
            {conflict && (
                <Alert className="mb-4">
                    <TriangleAlert />
                    <AlertTitle>Someone else saved changes</AlertTitle>
                    <AlertDescription>{conflict}</AlertDescription>
                    <AlertAction className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => copyText(stringifyDotenv(currentVars), "Your edits were copied as .env")}>
                            Copy my edits
                        </Button>
                        <Button size="sm" onClick={onSaved}>
                            Load latest
                        </Button>
                    </AlertAction>
                </Alert>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <SearchInput size="sm" id={FILTER_ID} value={filter} onChange={setFilter} placeholder="Filter keys" label="Filter variables by key" shortcut="/" />
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (revealAll ? setRevealAll(false) : withValues(() => setRevealAll(true)))}
                    aria-pressed={revealAll}
                >
                    {revealAll ? <EyeOff /> : <Eye />} {revealAll ? "Hide values" : "Reveal values"}
                </Button>
                <ButtonGroup>
                    {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
                            <ClipboardPaste /> Import
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            withValues(() => {
                                const all = knownVars(rowsRef.current);
                                copyText(stringifyDotenv(all), `Copied ${all.length} variables`);
                            })
                        }
                        disabled={!rows.some((r) => r.key.trim())}
                    >
                        <Copy /> Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => withValues(download)} disabled={!rows.some((r) => r.key.trim())}>
                        <Download /> Download
                    </Button>
                </ButtonGroup>
                {timedUnlock && (
                    <span className="ml-auto flex items-center gap-1 text-[12.5px] text-muted-foreground">
                        <LockOpen className="size-3.5" /> Values unlocked · {minutesLeft} min left
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[12.5px]" onClick={lock}>
                            Lock
                        </Button>
                    </span>
                )}
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    title={`No variables in ${envName}`}
                    action={
                        canEdit && (
                            <ButtonGroup>
                                <Button size="sm" variant="outline" onClick={addRow}>
                                    <Plus /> Add variable
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
                                    <ClipboardPaste /> Import .env
                                </Button>
                            </ButtonGroup>
                        )
                    }
                >
                    {canEdit
                        ? "Add variables one by one, or paste an existing .env file."
                        : "An editor on this team hasn't added any variables to this environment yet."}
                </EmptyState>
            ) : (
                <VarTable
                    rows={rows}
                    visible={visible}
                    filter={filter}
                    canEdit={canEdit}
                    keyCounts={keyCounts}
                    revealAll={revealAll}
                    revealed={revealed}
                    isChanged={(row) => {
                        const k = row.key.trim();
                        const original = row.origKey !== null ? baseline.find((v) => v.key === row.origKey) : undefined;
                        return (!!k || !!row.value) && (!original || k !== row.origKey || (row.value !== null && row.value !== original.value));
                    }}
                    onUpdate={update}
                    onRemove={(id) => setRows((rs) => rs.filter((r) => r.id !== id))}
                    onAdd={addRow}
                    onToggleReveal={(row, reveal) =>
                        reveal
                            ? withValues(() => setRevealed((s) => new Set(s).add(row.id)))
                            : setRevealed((s) => {
                                  const n = new Set(s);
                                  n.delete(row.id);
                                  return n;
                              })
                    }
                    onCopy={(row) =>
                        withValues(() => {
                            const v = rowsRef.current.find((r) => r.id === row.id)?.value;
                            if (v != null) copyText(v, `Copied ${row.key || "value"}`);
                        })
                    }
                    onUnlock={() => withValues(() => {})}
                />
            )}

            {canEdit && dirty && (
                // Pinned to the bottom of the window, centred on the editor, however long the list is.
                <div
                    className="pointer-events-none fixed bottom-5 z-30 flex justify-center px-4"
                    style={barBox ? { left: barBox.left, width: barBox.width } : { left: 0, right: 0 }}
                >
                    <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-popover py-1.5 pl-4 pr-1.5 shadow-lg shadow-black/10 animate-in fade-in-0 slide-in-from-bottom-2">
                        <span className="mr-1 text-[13px]">
                            {changes} unsaved change{changes === 1 ? "" : "s"}
                            {problems > 0 && <span className="text-destructive">, {problems} to fix</span>}
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => {
                                setRows(toRows(baseline));
                                setConflict(null);
                            }}
                        >
                            <RotateCcw /> Discard
                        </Button>
                        <Button size="sm" className="rounded-full" onClick={save} loading={saving} disabled={problems > 0}>
                            {/* Pill inside a pill: the key hint is rounded too, so the curves stay concentric. */}
                            Save <Kbd className="rounded-full bg-primary-foreground/15 px-1.5 text-primary-foreground/80 group-disabled/button:bg-foreground/10 group-disabled/button:text-muted-foreground">⌘S</Kbd>
                        </Button>
                    </div>
                </div>
            )}

            <UnlockDialog
                open={unlockOpen}
                onOpenChange={(open) => {
                    setUnlockOpen(open);
                    if (!open && !unlocked) pendingAction.current = null;
                }}
                onUnlocked={onReload}
            />

            <PasteDialog
                open={pasteOpen}
                onOpenChange={setPasteOpen}
                existingKeys={new Set(rows.map((r) => r.key.trim()))}
                onApply={(incoming) => {
                    setRows((rs) => {
                        const byKey = new Map(incoming.map((v) => [v.key, v.value]));
                        const merged = rs.map((r) => (byKey.has(r.key.trim()) ? { ...r, value: byKey.get(r.key.trim())! } : r));
                        const existing = new Set(rs.map((r) => r.key.trim()));
                        const added = toRows(incoming.filter((v) => !existing.has(v.key))).map((r) => ({ ...r, origKey: null }));
                        return [...merged.filter((r) => r.key || r.value), ...added];
                    });
                    toast.success(`Imported ${incoming.length} variable${incoming.length === 1 ? "" : "s"}. Review and save.`);
                }}
            />
        </div>
    );
}
