"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthHeading, GoogleButton, safeCallback } from "@/components/auth/auth-bits";

/**
 * New accounts are created with Google only, so every address is verified. People can set a password in
 * Account settings afterwards and then sign in with email and password too.
 */
function SignupForm() {
    const params = useSearchParams();
    const callbackUrl = safeCallback(params.get("callbackUrl"));

    return (
        <>
            <AuthHeading title="Create your account">
                Envoy accounts are created with <strong className="font-medium text-foreground">Google</strong>, so we know the email address is
                yours. You can set a password later in Account settings.
            </AuthHeading>

            <GoogleButton label="Sign up with Google" callbackUrl={callbackUrl} />

            <p className="mt-6 text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-foreground underline underline-offset-4 hover:text-foreground">
                    Sign in
                </Link>
            </p>
        </>
    );
}

export default function SignupPage() {
    return (
        <Suspense>
            <SignupForm />
        </Suspense>
    );
}
