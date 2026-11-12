"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { AuthHeading, FormError } from "@/components/auth/auth-bits";
import { api, fetcher } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import { FormField } from "@/components/common";
import { Input } from "@/components/ui/input";
import { InviteCodeField } from "@/components/invite-code-field";
import { INVITE_CODE_LENGTH } from "@/lib/invite-code";

export default function OnboardingPage() {
    const [name, setName] = useState("");
    const { data: session } = useSession();
    const prefilled = useRef(false);
    // People who already belong to an organization come here to create or join another one: they get a way back.
    const { data: orgs } = useSWR<{ orgs: unknown[] }>("/api/orgs?limit=1", fetcher);
    const hasOrg = (orgs?.orgs.length ?? 0) > 0;

    // Suggest "<First name>'s Organization" once the session loads; never overwrite what the user typed.
    useEffect(() => {
        const first = session?.user?.name?.trim().split(/\s+/)[0];
        if (prefilled.current || !first) return;
        prefilled.current = true;
        setName((current) => current || `${first}'s Organization`);
    }, [session]);
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<"create" | "join" | null>(null);

    async function createOrg(e: React.FormEvent) {
        e.preventDefault();
        setBusy("create");
        setError(null);
        try {
            const res = await api<{ org: { slug: string } }>("/api/orgs", { body: { name } });
            window.location.assign(`/o/${res.org.slug}`);
        } catch (err: any) {
            setError(err.message);
            setBusy(null);
        }
    }

    async function join(e?: React.FormEvent) {
        e?.preventDefault();
        if (code.length !== INVITE_CODE_LENGTH) return;
        setBusy("join");
        setError(null);
        try {
            const res = await api<{ org: { slug: string }; team: { slug: string } | null }>("/api/invites/accept", { body: { token: code } });
            window.location.assign(res.team ? `/o/${res.org.slug}/t/${res.team.slug}` : `/o/${res.org.slug}`);
        } catch (err: any) {
            setError(err.message);
            setBusy(null);
        }
    }

    return (
        <>
            <AuthHeading title={hasOrg ? "New organization" : "Get started"}>
                {hasOrg ? (
                    <>Create another organization, or join one with an invite code.</>
                ) : (
                    <>
                        Organizations hold your teams, projects and secrets. Create one for your company, or join one you&apos;ve
                        been invited to.
                    </>
                )}
            </AuthHeading>

            <FormError message={error} />

            <section className="mb-10">
                <h2 className="mb-3 text-sm font-medium text-foreground">Create an organization</h2>
                <form onSubmit={createOrg} className="flex flex-col gap-4">
                    <FormField
                        label="Organization name"
                        htmlFor="org-name"
                        hint={name ? <>URL: /o/<span className="font-mono text-foreground">{slugify(name)}</span></> : "Usually your company or group name."}
                    >
                        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={64} placeholder="Acme Inc." />
                    </FormField>
                    <div className="flex gap-2">
                        <Button type="submit" variant="default" className="flex-1" loading={busy === "create"} disabled={!name.trim()}>
                            Create organization
                        </Button>
                        {hasOrg && (
                            <Button asChild variant="outline">
                                <Link href="/dashboard">Cancel</Link>
                            </Button>
                        )}
                    </div>
                </form>
            </section>

            <section>
                <h2 className="mb-1 text-sm font-medium text-foreground">Join with an invite code</h2>
                <p className="mb-3 text-[13px] text-muted-foreground">
                    Enter the <strong className="font-semibold text-foreground">10-character code</strong> an admin shared with you. Pasting the
                    whole invite link works too.
                </p>
                <form onSubmit={join} className="flex flex-col gap-3">
                    <InviteCodeField value={code} onChange={setCode} disabled={busy === "join"} invalid={!!error && busy === null && code.length === INVITE_CODE_LENGTH} />
                    <Button type="submit" variant="outline" loading={busy === "join"} disabled={code.length !== INVITE_CODE_LENGTH}>
                        Join organization
                    </Button>
                </form>
            </section>

            {!hasOrg && (
                <p className="mt-12 text-[13px] text-muted-foreground">
                    <Button variant="link" className="h-auto p-0 text-[13px] text-foreground underline" onClick={() => signOut({ callbackUrl: "/" })}>
                        Sign out
                    </Button>
                </p>
            )}
        </>
    );
}
