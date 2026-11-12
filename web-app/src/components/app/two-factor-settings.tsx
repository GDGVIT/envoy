"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Fingerprint, KeyRound, MoreHorizontal, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton, ToneBadge, copyText } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DialogCancel, DialogSubmit } from "@/components/dialog-actions";
import { OtpField } from "@/components/otp-field";
import { QuickCreateDialog } from "@/components/quick-create-dialog";
import { api, fetcher } from "@/lib/api-client";
import { formatDate, timeAgo } from "@/lib/format";
import { confirmWithPasskey, createPasskey, passkeyError, passkeysSupported } from "@/lib/passkey-client";

type PasskeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null; backedUp: boolean };

function Row({ icon: Icon, title, meta, children }: { icon: React.ElementType; title: React.ReactNode; meta: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">{title}</div>
                <div className="truncate text-[13px] text-muted-foreground">{meta}</div>
            </div>
            {children}
        </div>
    );
}

/** Confirms with a passkey or an authenticator code, then shows a fresh set of backup codes. */
function RegenerateCodesDialog({
    open,
    onOpenChange,
    onDone,
    hasTotp,
    hasPasskey,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onDone: () => void;
    hasTotp: boolean;
    hasPasskey: boolean;
}) {
    const [code, setCode] = useState("");
    const [codes, setCodes] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setCode("");
            setCodes(null);
            setError(null);
        }
    }, [open]);

    async function run(get: () => Promise<{ backupCodes: string[] }>) {
        setBusy(true);
        setError(null);
        try {
            const res = await get();
            setCodes(res.backupCodes);
            onDone();
        } catch (e) {
            const message = passkeyError(e);
            if (message) setError(message);
            setCode("");
        } finally {
            setBusy(false);
        }
    }
    const withCode = (value: string) => run(() => api("/api/2fa/backup-codes", { body: { code: value } }));
    const withPasskey = () => run(() => confirmWithPasskey("backup-codes"));
    const usePasskey = hasPasskey && passkeysSupported();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{codes ? "Your new backup codes" : "Generate new backup codes"}</DialogTitle>
                    <DialogDescription>
                        {codes
                            ? "Your old codes no longer work. Save these somewhere safe; they won't be shown again."
                            : `Confirm it's you${usePasskey ? " with your passkey" : ""}${usePasskey && hasTotp ? " or" : ""}${hasTotp ? " with a code from your authenticator app" : ""}. Your current backup codes will stop working.`}
                    </DialogDescription>
                </DialogHeader>
                {codes ? (
                    <form
                        className="contents"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onOpenChange(false);
                        }}
                    >
                        <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-border p-4 font-mono text-[13px] text-foreground">
                            {codes.map((c) => (
                                <li key={c}>{c}</li>
                            ))}
                        </ol>
                        <DialogFooter>
                            <Button type="button" variant="outline" size="sm" className="mr-auto" onClick={() => copyText(codes.join("\n"), "Backup codes copied")}>
                                Copy codes
                            </Button>
                            <DialogSubmit autoFocus>Done</DialogSubmit>
                        </DialogFooter>
                    </form>
                ) : (
                    <form
                        className="contents"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (hasTotp && code.length === 6) withCode(code);
                            else if (usePasskey) withPasskey();
                        }}
                    >
                        <div className="flex flex-col gap-3">
                            {usePasskey && (
                                <Button type="button" variant="outline" className="w-full" onClick={withPasskey} loading={busy && !code}>
                                    <Fingerprint /> Use passkey
                                </Button>
                            )}
                            {usePasskey && hasTotp && <p className="text-center text-[12px] text-muted-foreground">or enter a code</p>}
                            {hasTotp && <OtpField value={code} onChange={setCode} onComplete={withCode} disabled={busy} invalid={!!error} />}
                            {error && <p className="text-[13px] text-destructive">{error}</p>}
                        </div>
                        <DialogFooter>
                            <DialogCancel onClick={() => onOpenChange(false)} />
                            {hasTotp ? (
                                <DialogSubmit loading={busy && !!code} disabled={code.length < 6}>
                                    Generate codes
                                </DialogSubmit>
                            ) : (
                                <DialogSubmit loading={busy}>Use passkey</DialogSubmit>
                            )}
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Shows the backup codes created with someone's first passkey or authenticator app. */
function NewBackupCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
    return (
        <Dialog open={!!codes} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save your backup codes</DialogTitle>
                    <DialogDescription>
                        Each code signs you in once if your passkey or phone isn&apos;t at hand. They won&apos;t be shown again.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="contents"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onClose();
                    }}
                >
                    <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-border p-4 font-mono text-[13px] text-foreground">
                        {(codes ?? []).map((c) => (
                            <li key={c}>{c}</li>
                        ))}
                    </ol>
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" className="mr-auto" onClick={() => copyText((codes ?? []).join("\n"), "Backup codes copied")}>
                            Copy codes
                        </Button>
                        <DialogSubmit autoFocus>I&apos;ve saved them</DialogSubmit>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Adds an authenticator app next to existing passkeys (the session has already passed 2FA). */
function AddAuthenticatorDialog({
    open,
    onOpenChange,
    onDone,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onDone: (res: { backupCodes: string[] | null; mfaTicket: string }) => void;
}) {
    const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setSetup(null);
            setCode("");
            setError(null);
            return;
        }
        api<{ secret: string; qr: string }>("/api/2fa/setup", { method: "POST" })
            .then(setSetup)
            .catch((e) => setError(e.message));
    }, [open]);

    async function submit(value: string) {
        setBusy(true);
        setError(null);
        try {
            const res = await api<{ backupCodes: string[] | null; mfaTicket: string }>("/api/2fa/enable", { body: { code: value } });
            toast.success("Authenticator app added");
            onOpenChange(false);
            onDone(res);
        } catch (e: any) {
            setError(e.message);
            setCode("");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add an authenticator app</DialogTitle>
                    <DialogDescription>Scan the code with your authenticator app, then enter the 6-digit code it shows.</DialogDescription>
                </DialogHeader>
                <form
                    className="contents"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (code.length === 6) submit(code);
                    }}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="size-40 rounded-lg bg-white p-2">
                            {setup ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={setup.qr} alt="QR code for your authenticator app" width={144} height={144} className="size-full" />
                            ) : (
                                <Skeleton className="size-full bg-neutral-200" />
                            )}
                        </div>
                        {setup && (
                            <div className="flex items-center gap-1">
                                <code className="font-mono text-[12px] tracking-wide text-muted-foreground">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                                <CopyButton value={setup.secret} label="Setup key" />
                            </div>
                        )}
                        <OtpField value={code} onChange={setCode} onComplete={submit} disabled={busy || !setup} invalid={!!error} />
                        {error && <p className="self-start text-[13px] text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <DialogCancel onClick={() => onOpenChange(false)} />
                        <DialogSubmit loading={busy} disabled={code.length < 6}>
                            Add app
                        </DialogSubmit>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Passkeys, authenticator app and backup codes on the account page. */
export function TwoFactorSettings({
    totpEnabled,
    backupCodesRemaining,
    onChanged,
}: {
    totpEnabled: boolean;
    backupCodesRemaining: number;
    onChanged: () => void;
}) {
    const { data, mutate } = useSWR<{ passkeys: PasskeyRow[] }>("/api/passkeys", fetcher);
    const passkeys = data?.passkeys ?? [];
    const [adding, setAdding] = useState(false);
    const [renaming, setRenaming] = useState<PasskeyRow | null>(null);
    const [removing, setRemoving] = useState<PasskeyRow | null>(null);
    const [regenOpen, setRegenOpen] = useState(false);
    const [totpOpen, setTotpOpen] = useState(false);
    const [supported, setSupported] = useState(true);
    const [newCodes, setNewCodes] = useState<string[] | null>(null);
    const [removeApp, setRemoveApp] = useState(false);
    const { update } = useSession();
    useEffect(() => setSupported(passkeysSupported()), []);
    const enrolled = totpEnabled || passkeys.length > 0;

    /** The first passkey or app: mark this session as verified and show the new backup codes. */
    async function afterFirstFactor(res: { backupCodes: string[] | null; mfaTicket: string | null }) {
        if (res.mfaTicket) await update({ mfaTicket: res.mfaTicket });
        if (res.backupCodes) setNewCodes(res.backupCodes);
    }

    async function add() {
        setAdding(true);
        try {
            const res = await createPasskey();
            toast.success(`Passkey "${res.passkey.name}" added`);
            await afterFirstFactor(res);
            await mutate();
            onChanged();
        } catch (e) {
            const message = passkeyError(e);
            if (message) toast.error(message);
        } finally {
            setAdding(false);
        }
    }

    return (
        <div id="two-factor" className="flex flex-col gap-4">
            {/* Passkeys */}
            <div className="overflow-hidden rounded-lg border">
                <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                            Passkeys {passkeys.length > 0 && <ToneBadge tone="mint">On</ToneBadge>}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                            Confirm with <strong className="font-medium text-foreground">Touch ID, Face ID, Windows Hello</strong> or your password manager.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={add} loading={adding} disabled={!supported}>
                        <Plus /> Add passkey
                    </Button>
                </div>
                {!data ? (
                    <div className="p-4">
                        <Skeleton className="h-9 w-full" />
                    </div>
                ) : passkeys.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] text-muted-foreground">
                        {supported ? "No passkeys yet. Add one to skip typing codes when you sign in." : "This browser doesn't support passkeys."}
                    </p>
                ) : (
                    <div className="divide-y">
                        {passkeys.map((p) => (
                            <Row
                                key={p.id}
                                icon={Fingerprint}
                                title={
                                    <>
                                        <span className="truncate">{p.name}</span>
                                        {p.backedUp && <ToneBadge tone="sky">Synced</ToneBadge>}
                                    </>
                                }
                                meta={
                                    <>
                                        Added <span title={formatDate(p.createdAt)}>{timeAgo(p.createdAt)}</span>
                                        {" · "}
                                        {p.lastUsedAt ? (
                                            <>
                                                last used <span title={formatDate(p.lastUsedAt)}>{timeAgo(p.lastUsedAt)}</span>
                                            </>
                                        ) : (
                                            "not used yet"
                                        )}
                                    </>
                                }
                            >
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" aria-label={`Options for ${p.name}`}>
                                            <MoreHorizontal />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setRenaming(p)}>
                                            <Pencil /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(p)}>
                                            <Trash2 /> Remove
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </Row>
                        ))}
                    </div>
                )}
            </div>

            {/* Authenticator app and backup codes */}
            <div className="divide-y overflow-hidden rounded-lg border">
                <Row
                    icon={Smartphone}
                    title={
                        <>
                            Authenticator app {totpEnabled ? <ToneBadge tone="mint">On</ToneBadge> : <ToneBadge tone="lemon">Not set up</ToneBadge>}
                        </>
                    }
                    meta={
                        totpEnabled
                            ? "6-digit codes from an app like 1Password or Google Authenticator."
                            : enrolled
                              ? "Optional when you have a passkey. Handy as a fallback."
                              : "Type a 6-digit code from an app like 1Password or Google Authenticator."
                    }
                >
                    {totpEnabled ? (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setRemoveApp(true)}>
                            Remove
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setTotpOpen(true)}>
                            Set up
                        </Button>
                    )}
                </Row>
                {enrolled && (
                <Row
                    icon={KeyRound}
                    title="Backup codes"
                    meta={<span className={backupCodesRemaining <= 3 ? "text-destructive" : undefined}>{backupCodesRemaining} of 10 left. Each one signs you in once.</span>}
                >
                    <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
                        Generate new codes
                    </Button>
                </Row>
                )}
            </div>

            <RegenerateCodesDialog
                open={regenOpen}
                onOpenChange={setRegenOpen}
                onDone={onChanged}
                hasTotp={totpEnabled}
                hasPasskey={passkeys.length > 0}
            />
            <AddAuthenticatorDialog
                open={totpOpen}
                onOpenChange={setTotpOpen}
                onDone={async (res) => {
                    await afterFirstFactor(res);
                    onChanged();
                }}
            />
            <NewBackupCodesDialog codes={newCodes} onClose={() => setNewCodes(null)} />
            <ConfirmDialog
                open={removeApp}
                onOpenChange={setRemoveApp}
                title="Remove the authenticator app?"
                description={
                    passkeys.length
                        ? "You'll confirm sign-ins with your passkey instead. Delete the Envoy entry from your authenticator app too."
                        : "This is your only second step, so sign-ins will need just your password or Google. Organizations that require two-factor won't let this happen."
                }
                actionLabel="Remove app"
                confirmText="remove"
                onConfirm={async () => {
                    try {
                        await api("/api/2fa/authenticator", { method: "DELETE" });
                        toast.success("Authenticator app removed");
                        await update();
                        onChanged();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
            {renaming && (
                <QuickCreateDialog
                    open
                    onOpenChange={(o) => !o && setRenaming(null)}
                    eyebrow="Rename passkey"
                    namePlaceholder="Passkey name"
                    initialName={renaming.name}
                    hint="A name that tells you which device or password manager it's in."
                    submitLabel="Rename"
                    onSubmit={async (name) => {
                        await api(`/api/passkeys/${renaming.id}`, { method: "PATCH", body: { name } });
                        toast.success("Passkey renamed");
                        await mutate();
                    }}
                />
            )}
            <ConfirmDialog
                open={!!removing}
                onOpenChange={(o) => !o && setRemoving(null)}
                title={`Remove "${removing?.name}"?`}
                description="You won't be able to sign in with this passkey any more. It stays in your password manager or device until you delete it there."
                actionLabel="Remove passkey"
                confirmText={removing?.name}
                onConfirm={async () => {
                    if (!removing) return;
                    try {
                        await api(`/api/passkeys/${removing.id}`, { method: "DELETE" });
                        toast.success("Passkey removed");
                        await update();
                        await mutate();
                        onChanged();
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
        </div>
    );
}
