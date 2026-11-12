"use client";

import { Suspense, useEffect, useState } from "react";
import { Fingerprint, Smartphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton, copyText } from "@/components/common";
import { OtpField } from "@/components/otp-field";
import { AuthHeading, FormError, safeCallback } from "@/components/auth/auth-bits";
import { api } from "@/lib/api-client";
import { createPasskey, passkeyError, passkeysSupported } from "@/lib/passkey-client";
import { cn } from "@/lib/utils";

type Setup = { secret: string; uri: string; qr: string };

function downloadCodes(codes: string[], email?: string | null) {
    const blob = new Blob(
        [`Envoy backup codes${email ? ` for ${email}` : ""}\nEach code works once.\n\n${codes.join("\n")}\n`],
        { type: "text/plain" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "envoy-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
}

const linkButton = "h-auto p-0 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground";

/** One way to do the second step, as a selectable card. */
function MethodCard({
    icon: Icon,
    title,
    badge,
    children,
    onClick,
    disabled,
    busy,
}: {
    icon: React.ElementType;
    title: string;
    badge?: string;
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    busy?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className={cn(
                "flex w-full items-start gap-3.5 rounded-lg border bg-background p-4 text-left transition-colors outline-none",
                "hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-4 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-50"
            )}
        >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {title}
                    {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{badge}</span>}
                    {busy && <span className="text-[12px] font-normal text-muted-foreground">Waiting for your device…</span>}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{children}</span>
            </span>
        </button>
    );
}

function SetupFlow() {
    const params = useSearchParams();
    const callbackUrl = safeCallback(params.get("callbackUrl"));
    const { data: session, update } = useSession();
    const [method, setMethod] = useState<"choose" | "totp">("choose");
    const [canPasskey, setCanPasskey] = useState(true);
    const [creating, setCreating] = useState(false);
    const [setup, setSetup] = useState<Setup | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [saved, setSaved] = useState(false);
    const email = session?.user?.email;

    useEffect(() => setCanPasskey(passkeysSupported()), []);

    // The authenticator secret is only created once someone picks that option.
    useEffect(() => {
        if (method !== "totp" || setup) return;
        api<Setup>("/api/2fa/setup", { method: "POST" })
            .then(setSetup)
            .catch((e) => setError(e.message));
    }, [method, setup]);

    async function addPasskey() {
        setCreating(true);
        setError(null);
        try {
            const res = await createPasskey();
            if (res.mfaTicket) await update({ mfaTicket: res.mfaTicket });
            if (res.backupCodes) setBackupCodes(res.backupCodes);
            else window.location.assign(callbackUrl);
        } catch (e) {
            const message = passkeyError(e);
            if (message) setError(message);
        } finally {
            setCreating(false);
        }
    }

    async function enable(value: string) {
        if (value.length !== 6) {
            setError("Enter all 6 digits.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await api<{ backupCodes: string[] | null; mfaTicket: string }>("/api/2fa/enable", { body: { code: value } });
            await update({ mfaTicket: res.mfaTicket });
            if (res.backupCodes) setBackupCodes(res.backupCodes);
            else window.location.assign(callbackUrl);
        } catch (e: any) {
            setError(e.message);
            setCode("");
        } finally {
            setBusy(false);
        }
    }

    if (backupCodes) {
        return (
            <>
                <AuthHeading title="Save your backup codes">Each code signs you in once if your passkey or phone isn&apos;t at hand.</AuthHeading>
                <ol className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm">
                    {backupCodes.map((c) => (
                        <li key={c}>{c}</li>
                    ))}
                </ol>
                <div className="mt-4 flex gap-4">
                    <Button variant="link" className={linkButton} onClick={() => copyText(backupCodes.join("\n"), "Backup codes copied")}>
                        Copy
                    </Button>
                    <Button variant="link" className={linkButton} onClick={() => downloadCodes(backupCodes, email)}>
                        Download
                    </Button>
                </div>
                <div className="mt-8 flex items-center gap-2.5">
                    <Checkbox id="saved-codes" checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
                    <Label htmlFor="saved-codes" className="font-normal">
                        I&apos;ve saved them
                    </Label>
                </div>
                <Button size="lg" className="mt-4 w-full" disabled={!saved} onClick={() => window.location.assign(callbackUrl)}>
                    Continue
                </Button>
            </>
        );
    }

    if (method === "choose") {
        return (
            <>
                <AuthHeading title="Add a second step to sign-in">
                    Envoy holds secrets, and some organizations require two-factor. Pick how you&apos;d like to confirm it&apos;s you.
                </AuthHeading>

                <FormError message={error} />

                <div className="flex flex-col gap-3">
                    <MethodCard icon={Fingerprint} title="Passkey" badge="Recommended" onClick={addPasskey} busy={creating} disabled={!canPasskey}>
                        {canPasskey ? (
                            <>
                                Confirm with <strong className="font-medium text-foreground">Touch ID, Face ID, Windows Hello</strong> or your password manager.
                                Nothing to type.
                            </>
                        ) : (
                            "This browser doesn't support passkeys. Use an authenticator app, or switch browsers."
                        )}
                    </MethodCard>
                    <MethodCard icon={Smartphone} title="Authenticator app" onClick={() => setMethod("totp")} disabled={creating}>
                        Type a 6-digit code from an app like <strong className="font-medium text-foreground">1Password or Google Authenticator</strong>.
                    </MethodCard>
                </div>

                <p className="mt-4 text-[13px] text-muted-foreground">You can add the other one later in Account settings.</p>

                <div className="mt-8 flex gap-5">
                    <Button variant="link" className={linkButton} onClick={() => window.location.assign(callbackUrl)}>
                        Not now
                    </Button>
                    <Button variant="link" className={linkButton} onClick={() => signOut({ callbackUrl: "/login" })}>
                        Use a different account
                    </Button>
                </div>
            </>
        );
    }

    return (
        <>
            <AuthHeading title="Set up an authenticator app">
                Scan the code with your authenticator app, then enter the 6-digit code it shows.
            </AuthHeading>

            <FormError message={error} />

            <div className="size-40 rounded-lg bg-white p-2">
                {setup ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={setup.qr} alt="QR code for your authenticator app" width={144} height={144} className="size-full" />
                ) : (
                    <Skeleton className="size-full bg-neutral-200" />
                )}
            </div>

            {setup &&
                (showKey ? (
                    <div className="mt-3 flex items-center gap-1">
                        <code className="font-mono text-[13px] tracking-wide text-muted-foreground">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                        <CopyButton value={setup.secret} label="Setup key" />
                    </div>
                ) : (
                    <Button variant="link" className={`${linkButton} mt-3`} onClick={() => setShowKey(true)}>
                        Can&apos;t scan it?
                    </Button>
                ))}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    enable(code);
                }}
                className="mt-8 flex flex-col gap-4"
            >
                <OtpField
                    value={code}
                    onChange={(v) => {
                        setCode(v);
                        if (error) setError(null);
                    }}
                    onComplete={enable}
                    disabled={busy || !setup}
                    invalid={!!error}
                />
                <Button type="submit" size="lg" loading={busy} className="w-full">
                    Verify
                </Button>
            </form>

            <div className="mt-8 flex gap-5">
                <Button
                    variant="link"
                    className={linkButton}
                    onClick={() => {
                        setMethod("choose");
                        setError(null);
                    }}
                >
                    Use a passkey instead
                </Button>
                <Button variant="link" className={linkButton} onClick={() => signOut({ callbackUrl: "/login" })}>
                    Use a different account
                </Button>
            </div>
        </>
    );
}

export default function TwoFactorSetupPage() {
    return (
        <Suspense>
            <SetupFlow />
        </Suspense>
    );
}
