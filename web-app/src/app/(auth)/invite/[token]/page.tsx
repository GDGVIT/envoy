"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { AuthHeading, FormError } from "@/components/auth/auth-bits";
import { api, fetcher } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

type Preview = {
    invite: {
        org: string;
        team: string | null;
        orgRole: string;
        teamRole: string | null;
        invitedBy: string | null;
        expiresAt: string;
        status: "active" | "revoked" | "expired" | "used_up";
    };
};

const STATUS_COPY: Record<string, string> = {
    revoked: "This invite was revoked. Ask an admin for a new one.",
    expired: "This invite has expired. Ask an admin for a new one.",
    used_up: "This invite has reached its usage limit. Ask an admin for a new one.",
};

export default function InvitePage() {
    const { token } = useParams<{ token: string }>();
    const { data: session, status } = useSession();
    const { data, error: loadError } = useSWR<Preview>(`/api/invites/preview/${token}`, fetcher);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const here = `/invite/${token}`;

    if (loadError) {
        return (
            <AuthHeading title="Invite not found">
                This invite link or code isn&apos;t valid. Check that you copied all of it, or ask an admin for a new invite.
            </AuthHeading>
        );
    }
    if (!data) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-full" />
            </div>
        );
    }

    const { invite } = data;
    const where = invite.team ? `the ${invite.team} team in ${invite.org}` : invite.org;
    const role = invite.team ? `${invite.teamRole === "editor" ? "edit" : "read-only"} access` : `${invite.orgRole} access`;

    async function accept() {
        setBusy(true);
        setError(null);
        try {
            const res = await api<{ org: { slug: string }; team: { slug: string } | null }>("/api/invites/accept", { body: { token } });
            window.location.assign(res.team ? `/o/${res.org.slug}/t/${res.team.slug}` : `/o/${res.org.slug}`);
        } catch (e: any) {
            setError(e.message);
            setBusy(false);
        }
    }

    const verified = session?.user?.mfaVerified;

    return (
        <>
            <AuthHeading title={`Join ${invite.org}`}>
                {invite.invitedBy ?? "An admin"} invited you to {where} with {role}.
            </AuthHeading>

            <FormError message={error ?? (invite.status !== "active" ? STATUS_COPY[invite.status] : null)} />

            {invite.status === "active" &&
                (status === "loading" ? (
                    <Skeleton className="h-11 w-full" />
                ) : verified ? (
                    <div className="flex flex-col gap-3">
                        <Button variant="default" size="lg" loading={busy} onClick={accept}>
                            Join {invite.org}
                        </Button>
                        <p className="text-[13px] text-muted-foreground">Signed in as {session?.user?.email}.</p>
                    </div>
                ) : session ? (
                    <Button asChild variant="default" size="lg" className="w-full">
                        <Link href={`/2fa/verify?callbackUrl=${encodeURIComponent(here)}`}>Finish signing in to join</Link>
                    </Button>
                ) : (
                    <div className="flex flex-col gap-2">
                        <Button asChild variant="default" size="lg">
                            <Link href={`/signup?callbackUrl=${encodeURIComponent(here)}`}>Create an account to join</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg">
                            <Link href={`/login?callbackUrl=${encodeURIComponent(here)}`}>I already have an account</Link>
                        </Button>
                    </div>
                ))}
        </>
    );
}
