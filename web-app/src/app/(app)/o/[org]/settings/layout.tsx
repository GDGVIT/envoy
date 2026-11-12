"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/app/app-shell";
import { PageHeader } from "@/components/common";
import { useOrg } from "@/components/app/org-context";
import { LoadError, LoadingPage } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const { slug, data, error, isAdmin, mutate } = useOrg();
    const pathname = usePathname();

    if (error) return <LoadError error={error} notFoundTitle="Organization not found" onRetry={() => mutate()} />;
    if (!data) return <LoadingPage />;

    const base = `/o/${slug}/settings`;
    const tabs = [
        { href: base, label: "General" },
        { href: `${base}/members`, label: "Members" },
        ...(isAdmin
            ? [
                  { href: `${base}/invites`, label: "Invitations" },
                  { href: `${base}/audit`, label: "Audit log" },
              ]
            : []),
    ];

    return (
        <PageContainer>
            <PageHeader title="Settings" description={`Manage ${data.org.name}: its profile, members, invitations and audit log.`} />
            <nav aria-label="Settings" className="no-scrollbar -mt-2 mb-8 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
                {tabs.map((t) => {
                    const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "-mb-px flex h-10 shrink-0 items-center border-b-2 px-3 text-[13.5px]",
                                active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>
            {children}
        </PageContainer>
    );
}
