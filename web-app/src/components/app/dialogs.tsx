"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuickCreateDialog } from "@/components/quick-create-dialog";
import { api } from "@/lib/api-client";
import { useOrg } from "./org-context";

export function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const { slug, mutate } = useOrg();
    const router = useRouter();
    return (
        <QuickCreateDialog
            open={open}
            onOpenChange={onOpenChange}
            eyebrow="New team"
            namePlaceholder="Team name"
            description={{ placeholder: "What does this team work on? (optional)" }}
            slugPrefix="/t/"
            submitLabel="Create team"
            onSubmit={async (name, description) => {
                const res = await api<{ team: { slug: string } }>(`/api/orgs/${slug}/teams`, {
                    body: { name, description: description || undefined },
                });
                await mutate();
                toast.success(`Created ${name}`);
                router.push(`/o/${slug}/t/${res.team.slug}`);
            }}
        />
    );
}

export function CreateProjectDialog({
    open,
    onOpenChange,
    teamSlug,
    teamName,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    teamSlug: string;
    teamName: string;
    onCreated?: () => void;
}) {
    const { slug, mutate } = useOrg();
    const router = useRouter();
    return (
        <QuickCreateDialog
            open={open}
            onOpenChange={onOpenChange}
            eyebrow={`New project in ${teamName}`}
            namePlaceholder="Project name"
            description={{ placeholder: "What is this project? (optional)" }}
            slugPrefix="/p/"
            submitLabel="Create project"
            onSubmit={async (name, description) => {
                const res = await api<{ project: { slug: string } }>(`/api/orgs/${slug}/teams/${teamSlug}/projects`, {
                    body: { name, description: description || undefined },
                });
                await mutate();
                onCreated?.();
                toast.success(`Created ${name}`);
                router.push(`/o/${slug}/t/${teamSlug}/p/${res.project.slug}`);
            }}
        />
    );
}
