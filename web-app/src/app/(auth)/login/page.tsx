"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { AuthHeading, FormError, GoogleButton, OrDivider, authErrorMessage, safeCallback } from "@/components/auth/auth-bits";
import { FormField } from "@/components/common";
import { Input } from "@/components/ui/input";

function LoginForm() {
    const params = useSearchParams();
    const callbackUrl = safeCallback(params.get("callbackUrl"));
    const [error, setError] = useState<string | null>(authErrorMessage(params.get("error")));
    const [busy, setBusy] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await signIn("credentials", {
            username: String(form.get("username") ?? ""),
            password: String(form.get("password") ?? ""),
            redirect: false,
        });
        if (!res || res.error) {
            setError(authErrorMessage(res?.error ?? "CredentialsSignin"));
            setBusy(false);
            return;
        }
        // Middleware routes the session to 2FA setup or verification before the destination.
        window.location.assign(callbackUrl);
    }

    return (
        <>
            <AuthHeading title="Sign in to Envoy">If you&apos;ve set up a passkey or authenticator app, you&apos;ll confirm with it next.</AuthHeading>

            <FormError message={error} />

            <GoogleButton label="Continue with Google" callbackUrl={callbackUrl} />
            <OrDivider />

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <FormField label="Email" htmlFor="username">
                    <Input id="username" name="username" type="email" autoComplete="username" required />
                </FormField>
                <FormField label="Password" htmlFor="password">
                    <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </FormField>
                <Button type="submit" variant="default" size="lg" loading={busy} className="mt-2">
                    Sign in
                </Button>
            </form>
            <p className="mt-3 text-[13px] text-muted-foreground">
                Signed up with Google? Set a password in <strong className="font-medium text-foreground">Account settings</strong> to sign in with
                email too.
            </p>

            <p className="mt-8 text-sm text-muted-foreground">
                New to Envoy?{" "}
                <Link
                    href={`/signup${params.get("callbackUrl") ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                    className="text-foreground underline underline-offset-4 hover:text-foreground"
                >
                    Create an account
                </Link>
            </p>
        </>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
