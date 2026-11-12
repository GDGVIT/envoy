"use client";

import { Suspense, useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthHeading, FormError, safeCallback } from "@/components/auth/auth-bits";
import { OtpField } from "@/components/otp-field";
import { api } from "@/lib/api-client";
import { confirmWithPasskey, passkeyError, passkeysSupported } from "@/lib/passkey-client";

type Mode = "passkey" | "totp" | "backup";
type Methods = { totp: boolean; passkeys: number; backupCodes: number };

const linkButton = "h-auto p-0 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground";

function VerifyFlow() {
    const params = useSearchParams();
    const callbackUrl = safeCallback(params.get("callbackUrl"));
    const { update } = useSession();
    const [methods, setMethods] = useState<Methods | null>(null);
    const [mode, setMode] = useState<Mode>("totp");
    const [code, setCode] = useState("");
    const [backup, setBackup] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Start with a passkey when the account has one and this browser can use it.
    useEffect(() => {
        api<Methods>("/api/2fa/methods")
            .then((m) => {
                setMethods(m);
                setMode(m.passkeys > 0 && passkeysSupported() ? "passkey" : m.totp ? "totp" : "backup");
            })
            .catch(() => setMethods({ totp: true, passkeys: 0, backupCodes: 0 }));
    }, []);

    async function finish(mfaTicket: string, backupCodesRemaining?: number) {
        const next = await update({ mfaTicket });
        if (!next?.user?.mfaVerified) throw new Error("Verification expired. Try again.");
        if (typeof backupCodesRemaining === "number" && backupCodesRemaining <= 3) {
            sessionStorage.setItem("envoy:lowBackupCodes", String(backupCodesRemaining));
        }
        window.location.assign(callbackUrl);
    }

    async function withPasskey() {
        setBusy(true);
        setError(null);
        try {
            const res = await confirmWithPasskey<{ mfaTicket: string }>("login");
            await finish(res.mfaTicket);
        } catch (e) {
            const message = passkeyError(e);
            if (message) setError(message);
            setBusy(false);
        }
    }

    async function verify(body: { code: string } | { backupCode: string }) {
        if ("code" in body && body.code.length !== 6) {
            setError("Enter all 6 digits.");
            return;
        }
        if ("backupCode" in body && body.backupCode.trim().length < 10) {
            setError("Enter a full backup code.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await api<{ mfaTicket: string; backupCodesRemaining?: number }>("/api/2fa/verify", { body });
            await finish(res.mfaTicket, res.backupCodesRemaining);
        } catch (e: any) {
            setError(e.message);
            setCode("");
            setBusy(false);
        }
    }

    const switchTo = (m: Mode) => {
        setMode(m);
        setError(null);
    };
    const others: { mode: Mode; label: string }[] = [
        ...(mode !== "passkey" && (methods?.passkeys ?? 0) > 0 && passkeysSupported() ? [{ mode: "passkey" as Mode, label: "Use a passkey" }] : []),
        ...(mode !== "totp" && methods?.totp ? [{ mode: "totp" as Mode, label: "Use authenticator app" }] : []),
        ...(mode !== "backup" ? [{ mode: "backup" as Mode, label: "Use a backup code" }] : []),
    ];

    return (
        <>
            <AuthHeading title="Confirm it's you">
                {mode === "passkey"
                    ? "Use your passkey to finish signing in."
                    : mode === "totp"
                      ? "Enter the 6-digit code from your authenticator app."
                      : "Enter one of your backup codes."}
            </AuthHeading>

            <FormError message={error} />

            {mode === "passkey" ? (
                <Button size="lg" className="w-full" loading={busy} onClick={withPasskey} autoFocus>
                    <Fingerprint /> Use passkey
                </Button>
            ) : (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        verify(mode === "totp" ? { code } : { backupCode: backup });
                    }}
                    className="flex flex-col gap-4"
                >
                    {mode === "totp" ? (
                        <OtpField
                            value={code}
                            onChange={(v) => {
                                setCode(v);
                                if (error) setError(null);
                            }}
                            onComplete={(v) => verify({ code: v })}
                            disabled={busy || !methods}
                            invalid={!!error}
                        />
                    ) : (
                        <Input
                            autoFocus
                            aria-label="Backup code"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="xxxxx-xxxxx"
                            className="h-12 font-mono text-base"
                            value={backup}
                            onChange={(e) => setBackup(e.target.value)}
                        />
                    )}
                    <Button type="submit" size="lg" loading={busy} className="w-full">
                        Verify
                    </Button>
                </form>
            )}

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {others.map((o) => (
                    <Button key={o.mode} variant="link" className={linkButton} onClick={() => switchTo(o.mode)}>
                        {o.label}
                    </Button>
                ))}
                <Button variant="link" className={linkButton} onClick={() => signOut({ callbackUrl: "/login" })}>
                    Sign out
                </Button>
            </div>
        </>
    );
}

export default function TwoFactorVerifyPage() {
    return (
        <Suspense>
            <VerifyFlow />
        </Suspense>
    );
}
