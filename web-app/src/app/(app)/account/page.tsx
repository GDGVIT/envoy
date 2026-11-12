"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/app-shell";
import { TwoFactorSettings } from "@/components/app/two-factor-settings";
import { LoadingPage } from "@/components/app/states";
import { api, fetcher } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { FormField, PageHeader, Section, ToneBadge, UserAvatar } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Me = {
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
        username?: string;
        provider: "credentials" | "google";
        emailVerified: boolean;
        totpEnabled: boolean;
        hasPassword: boolean;
        backupCodesRemaining: number;
        createdAt: string;
        apiTokens: number;
    };
};

export default function AccountPage() {
    const { data, mutate } = useSWR<Me>("/api/me", fetcher);
    const [name, setName] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [signOutAllOpen, setSignOutAllOpen] = useState(false);
    const [pw, setPw] = useState({ current: "", next: "" });
    const [pwBusy, setPwBusy] = useState(false);
    const [pwError, setPwError] = useState<string | null>(null);

    useEffect(() => {
        if (data) setName(data.user.name);
    }, [data]);

    if (!data) return <LoadingPage />;
    const { user } = data;

    return (
        <PageContainer>
            <PageHeader title="Account and security" description={`Signed in as ${user.email}`} />

            <Section title="Profile" description="Your name is shown to people in your organizations." className="border-t-0 pt-0">
                <div className="mb-6 flex items-center gap-4">
                    <UserAvatar name={user.name} src={user.image} className="size-14 text-base" />
                    <p className="text-[13px] text-muted-foreground">
                        {user.image ? "Your photo comes from your Google account." : "Sign in with Google to use your Google profile photo."}
                    </p>
                </div>
                <form
                    className="flex max-w-md flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setSavingName(true);
                        try {
                            await api("/api/me", { method: "PATCH", body: { name } });
                            toast.success("Profile updated. It shows everywhere after your next sign-in.");
                            mutate();
                        } catch (err: any) {
                            toast.error(err.message);
                        } finally {
                            setSavingName(false);
                        }
                    }}
                >
                    <FormField label="Name" htmlFor="name">
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required />
                    </FormField>
                    <FormField
                        label="Email"
                        htmlFor="email"
                        hint={
                            user.emailVerified
                                ? "Verified through Google. You can accept email invitations."
                                : "Not verified. Join organizations with invite links, or sign in with Google using this address to verify it."
                        }
                    >
                        <Input id="email" value={user.email} disabled />
                    </FormField>
                    <div>
                        <Button type="submit" variant="default" loading={savingName} disabled={name === user.name}>
                            Save profile
                        </Button>
                    </div>
                </form>
            </Section>

            <Section
                title="Two-factor authentication"
                description="An optional second step when you sign in, required by some organizations. A passkey is the quickest; backup codes get you in if your devices aren't at hand."
            >
                <TwoFactorSettings totpEnabled={user.totpEnabled} backupCodesRemaining={user.backupCodesRemaining} onChanged={() => mutate()} />
            </Section>

            <Section
                title="Password"
                description={
                    user.hasPassword
                        ? "Changing your password signs you out everywhere, including here."
                        : "Accounts are created with Google. Set a password to also sign in with your email and password."
                }
            >
                <form
                    className="flex max-w-md flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setPwBusy(true);
                        setPwError(null);
                        try {
                            const res = await api<{ signedOut: boolean }>("/api/account/password", {
                                body: user.hasPassword ? { currentPassword: pw.current, newPassword: pw.next } : { newPassword: pw.next },
                            });
                            if (res.signedOut) {
                                toast.success("Password changed. Sign in again with your new password.");
                                await signOut({ callbackUrl: "/login" });
                                return;
                            }
                            toast.success(`Password set. You can now sign in with ${user.email} and this password.`);
                            setPw({ current: "", next: "" });
                            setPwBusy(false);
                            mutate();
                        } catch (err: any) {
                            setPwError(err.message);
                            setPwBusy(false);
                        }
                    }}
                >
                    {/* Lets password managers save the new password against the right account. */}
                    <input type="email" name="email" autoComplete="username" value={user.email} readOnly hidden />
                    {user.hasPassword && (
                        <FormField label="Current password" htmlFor="pw-current">
                            <Input
                                id="pw-current"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={pw.current}
                                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                            />
                        </FormField>
                    )}
                    <FormField label={user.hasPassword ? "New password" : "Password"} htmlFor="pw-next" error={pwError} hint="At least 10 characters.">
                        <Input
                            id="pw-next"
                            type="password"
                            autoComplete="new-password"
                            minLength={10}
                            required
                            value={pw.next}
                            onChange={(e) => setPw({ ...pw, next: e.target.value })}
                        />
                    </FormField>
                    <div>
                        <Button type="submit" variant="default" loading={pwBusy}>
                            {user.hasPassword ? "Change password" : "Set password"}
                        </Button>
                    </div>
                </form>
            </Section>

            <Section title="API tokens" description="Personal tokens for the CLI, scripts and CI. They act with your access.">
                <div className="flex items-center gap-3">
                    <p className="flex-1 text-sm text-foreground">
                        {user.apiTokens} active token{user.apiTokens === 1 ? "" : "s"}
                    </p>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/account/tokens">Manage tokens</Link>
                    </Button>
                </div>
            </Section>

            <Section title="Sessions" description="Sign out on every device and browser, including this one.">
                <div className="flex flex-col items-start gap-2">
                    <Button variant="outline" onClick={() => setSignOutAllOpen(true)}>
                        Sign out everywhere
                    </Button>
                    <p className="text-xs text-muted-foreground">Account created {formatDate(user.createdAt)}.</p>
                </div>
            </Section>

            <ConfirmDialog
                open={signOutAllOpen}
                onOpenChange={setSignOutAllOpen}
                title="Sign out everywhere?"
                description="Every session on every device ends now. API tokens keep working; revoke them separately."
                actionLabel="Sign out everywhere"
                onConfirm={async () => {
                    await api("/api/account/sessions", { method: "DELETE" });
                    await signOut({ callbackUrl: "/login" });
                }}
            />
        </PageContainer>
    );
}
