"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowRight, CircleCheck, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, fetcher } from "@/lib/api-client";

type Security = { require2fa: boolean; membersWithout2fa: { name: string; email: string; image?: string | null }[] | null };

/** The org's "require two-factor" switch. Owner only; everyone else sees the current setting. */
export function OrgSecurity({ slug, isOwner }: { slug: string; isOwner: boolean }) {
    const { data, mutate } = useSWR<Security>(`/api/orgs/${slug}/security`, fetcher);
    const [pending, setPending] = useState<boolean | null>(null);

    if (!data) return <Skeleton className="h-20 w-full max-w-2xl" />;
    const without = data.membersWithout2fa ?? [];

    async function apply(require2fa: boolean) {
        try {
            const res = await api<Security>(`/api/orgs/${slug}/security`, { method: "PATCH", body: { require2fa } });
            await mutate(res, { revalidate: false });
            toast.success(require2fa ? "Two-factor authentication is now required" : "Two-factor authentication is now optional");
        } catch (e: any) {
            toast.error(e.message);
            throw e;
        }
    }

    const shown = without.slice(0, 4);

    return (
        <div className="max-w-2xl">
            <div className="overflow-hidden rounded-xl border bg-background">
                <div className="flex items-center gap-4 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-mint text-pastel-mint-fg">
                        <ShieldCheck className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <label htmlFor="require-2fa" className="block text-sm font-medium text-foreground">
                            Require two-factor authentication
                        </label>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                            Members need a <strong className="font-medium text-foreground">passkey or an authenticator app</strong> to open anything in
                            this organization.
                        </p>
                    </div>
                    <Switch id="require-2fa" checked={data.require2fa} disabled={!isOwner} onCheckedChange={(v) => setPending(v)} />
                </div>

                {without.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-muted/30 px-4 py-3">
                        <div className="flex -space-x-1.5" aria-hidden>
                            {shown.map((m) => (
                                <UserAvatar key={m.email} name={m.name} src={m.image} className="size-6 ring-2 ring-background" />
                            ))}
                        </div>
                        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                            <strong className="font-medium text-foreground">
                                {without.length} member{without.length === 1 ? "" : "s"}
                            </strong>{" "}
                            {without.length === 1 ? "hasn't" : "haven't"} set up two-factor
                            {data.require2fa ? ", so they can't open the organization yet" : " yet"}
                            <span className="hidden sm:inline">
                                {": "}
                                {shown.map((m) => m.name.split(" ")[0]).join(", ")}
                                {without.length > shown.length ? ` and ${without.length - shown.length} more` : ""}
                            </span>
                            .
                        </p>
                        <Button asChild variant="ghost" size="sm" className="-my-1 text-[13px]">
                            <Link href={`/o/${slug}/settings/members`}>
                                See members <ArrowRight />
                            </Link>
                        </Button>
                    </div>
                ) : (
                    data.require2fa && (
                        <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
                            <CircleCheck className="size-4 text-primary" /> Everyone in the organization has two-factor set up.
                        </div>
                    )
                )}
            </div>
            {!isOwner && <p className="mt-2 text-[12.5px] text-muted-foreground">Only the owner can change this.</p>}

            <ConfirmDialog
                open={pending !== null}
                onOpenChange={(o) => !o && setPending(null)}
                danger={pending === false}
                title={pending ? "Require two-factor authentication?" : "Make two-factor optional?"}
                description={
                    pending ? (
                        without.length ? (
                            <>
                                <strong className="font-medium text-foreground">
                                    {without.length} member{without.length === 1 ? "" : "s"}
                                </strong>{" "}
                                without a passkey or authenticator app will be asked to add one before they can open anything here.
                            </>
                        ) : (
                            "Everyone in the organization already has two-factor set up, so nobody is interrupted."
                        )
                    ) : (
                        "Members without a passkey or authenticator app will be able to open the organization. Anyone who has one keeps using it."
                    )
                }
                actionLabel={pending ? "Require two-factor" : "Make optional"}
                onConfirm={() => apply(!!pending)}
            />
        </div>
    );
}
