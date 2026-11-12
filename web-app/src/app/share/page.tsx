"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardPaste, Eye, EyeOff, Link2, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, EmptyState, FormField, PageHeader, copyText } from "@/components/common";
import { PasteDialog, VarTable, nextRowId, useRowProblems, type Row } from "@/components/app/var-table";
import { api } from "@/lib/api-client";
import { SHARE_TTL_OPTIONS } from "@/lib/share";

const EXPIRY = SHARE_TTL_OPTIONS.map((o) => ({ value: String(o.seconds), label: o.label }));
const newRow = (key = "", value = ""): Row => ({ id: nextRowId(), key, value, origKey: null });

export default function TemporaryLinkPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [revealAll, setRevealAll] = useState(false);
    const [revealed, setRevealed] = useState<Set<string>>(new Set());
    const [pasteOpen, setPasteOpen] = useState(false);
    const [ttl, setTtl] = useState("3600");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [link, setLink] = useState<string | null>(null);
    const focusRowId = useRef<string | null>(null);

    const { keyCounts, problems } = useRowProblems(rows);
    const vars = rows.filter((r) => r.key.trim()).map((r) => ({ key: r.key.trim(), value: r.value ?? "" }));

    const addRow = () => {
        const row = newRow();
        focusRowId.current = row.id;
        setRows((rs) => [...rs, row]);
    };
    useEffect(() => {
        if (focusRowId.current) {
            document.getElementById(`key-${focusRowId.current}`)?.focus();
            focusRowId.current = null;
        }
    }, [rows.length]);

    async function create(e: React.FormEvent) {
        e.preventDefault();
        if (!vars.length) {
            setError("Add at least one variable.");
            return;
        }
        if (problems) {
            setError("Fix the highlighted keys first: keys must be unique and use letters, digits, _ . -");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await api<{ token: string }>("/api/share", { body: { vars, expiresInSeconds: Number(ttl) } });
            setLink(`${window.location.origin}/share/${res.token}`);
            setRows([]);
            setRevealAll(false);
            setRevealed(new Set());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <PageHeader
                title="Create a temporary link"
                description={
                    <>
                        Share a .env with someone once. The link <strong className="font-semibold text-foreground">expires after at most 24 hours</strong> and
                        is then deleted. For ongoing access, use an organization so you control who can see each environment.
                    </>
                }
            />

            {link ? (
                <Alert>
                    <Link2 />
                    <AlertTitle>Your link is ready</AlertTitle>
                    <AlertDescription>
                        <p>Anyone with this link can read the variables until it expires, then it&apos;s deleted. Send it over a private channel.</p>
                        <div className="mt-3 flex w-full items-center gap-1 rounded-md bg-muted py-1 pl-3 pr-1">
                            <code className="flex-1 truncate font-mono text-[12.5px] text-foreground">{link}</code>
                            <CopyButton value={link} label="Link" />
                        </div>
                        <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setLink(null)}>
                            Share something else
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <form onSubmit={create} className="flex flex-col gap-5">
                    {/* Same toolbar and table as editing an environment in the app. */}
                    <div>
                        {/* Actions sit above the table, like the toolbar of an environment in the app. */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <ButtonGroup>
                                <Button type="button" size="sm" variant="outline" onClick={addRow}>
                                    <Plus /> Add variable
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
                                    <ClipboardPaste /> Import .env
                                </Button>
                            </ButtonGroup>
                            {rows.length > 0 && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => setRevealAll((r) => !r)} aria-pressed={revealAll}>
                                    {revealAll ? <EyeOff /> : <Eye />} {revealAll ? "Hide values" : "Reveal values"}
                                </Button>
                            )}
                        </div>
                        {rows.length === 0 ? (
                            <EmptyState title="Add the variables to share">Add them one by one, or paste an existing .env file.</EmptyState>
                        ) : (
                            <VarTable
                                rows={rows}
                                canEdit
                                keyCounts={keyCounts}
                                revealAll={revealAll}
                                revealed={revealed}
                                onUpdate={(id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
                                onRemove={(id) => setRows((rs) => rs.filter((r) => r.id !== id))}
                                onAdd={addRow}
                                onToggleReveal={(row, reveal) =>
                                    setRevealed((s) => {
                                        const n = new Set(s);
                                        if (reveal) n.add(row.id);
                                        else n.delete(row.id);
                                        return n;
                                    })
                                }
                                onCopy={(row) => row.value && copyText(row.value, `Copied ${row.key || "value"}`)}
                            />
                        )}
                        {error && (
                            <p role="alert" className="mt-2 text-[13px] text-destructive">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <FormField label="Expires after" htmlFor="share-ttl" className="w-48 gap-2">
                            <Select value={ttl} onValueChange={setTtl}>
                                <SelectTrigger id="share-ttl" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {EXPIRY.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                        <Button type="submit" loading={busy} disabled={!vars.length || problems > 0}>
                            <Link2 /> Create link
                        </Button>
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                        Values are encrypted at rest. Want access control and an audit log?{" "}
                        <Link href="/signup" className="text-foreground underline underline-offset-4">
                            Create an organization
                        </Link>
                        .
                    </p>
                </form>
            )}

            <PasteDialog
                open={pasteOpen}
                onOpenChange={setPasteOpen}
                description="Paste the contents of a .env file. Keys already in the list are overwritten."
                existingKeys={new Set(rows.map((r) => r.key.trim()))}
                onApply={(incoming) =>
                    setRows((rs) => {
                        const byKey = new Map(incoming.map((v) => [v.key, v.value]));
                        const merged = rs.map((r) => (byKey.has(r.key.trim()) ? { ...r, value: byKey.get(r.key.trim())! } : r));
                        const existing = new Set(rs.map((r) => r.key.trim()));
                        const added = incoming.filter((v) => !existing.has(v.key)).map((v) => newRow(v.key, v.value));
                        return [...merged.filter((r) => r.key || r.value), ...added];
                    })
                }
            />
        </>
    );
}
