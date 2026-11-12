"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/brand/logo";

export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
        <div className="mb-8">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
            {children && <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>}
        </div>
    );
}

export function GoogleButton({ label, callbackUrl }: { label: string; callbackUrl: string }) {
    const [busy, setBusy] = useState(false);
    return (
        <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            loading={busy}
            onClick={async () => {
                setBusy(true);
                await signIn("google", { callbackUrl });
            }}
        >
            {!busy && <GoogleIcon />}
            {label}
        </Button>
    );
}

export function OrDivider() {
    return (
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
        </div>
    );
}

export function FormError({ message }: { message?: string | null }) {
    if (!message) return null;
    return (
        <Alert variant="destructive" className="mb-5">
            <CircleAlert />
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}

const AUTH_ERRORS: Record<string, string> = {
    CredentialsSignin: "Incorrect email, username or password.",
    SessionRevoked: "Your session ended. Sign in again to continue.",
    OAuthAccountNotLinked: "This email is linked to a different sign-in method.",
    AccessDenied: "Google didn't confirm this email address.",
    Callback: "Google sign-in didn't complete. Try again.",
    OAuthCallback: "Google sign-in didn't complete. Try again.",
};

export function authErrorMessage(code?: string | null) {
    if (!code) return null;
    return AUTH_ERRORS[code] ?? code;
}

/** Only allow same-origin relative callback paths. */
export function safeCallback(url?: string | null, fallback = "/dashboard") {
    return url && url.startsWith("/") && !url.startsWith("//") ? url : fallback;
}
