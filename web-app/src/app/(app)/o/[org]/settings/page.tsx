"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { useOrg } from "@/components/app/org-context";
import { api } from "@/lib/api-client";
import { FormField, Section } from "@/components/common";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { OrgSecurity } from "@/components/app/org-security";

export default function GeneralSettingsPage() {
    const { data, slug, mutate, isAdmin, isOwner } = useOrg();
    const router = useRouter();
    const [name, setName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    useEffect(() => {
        if (data) {
            setName(data.org.name);
            setNewSlug(data.org.slug);
        }
    }, [data]);

    if (!data) return null;
    const changed = name !== data.org.name || newSlug !== data.org.slug;

    return (
        <div>
            <Section title="Organization profile" description="The name appears across Envoy; the URL is used in links and API paths." className="border-t-0 pt-0">
                <form
                    className="flex max-w-md flex-col gap-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setError(null);
                        try {
                            const res = await api<{ org: { slug: string } }>(`/api/orgs/${slug}`, {
                                method: "PATCH",
                                body: { name, slug: newSlug !== data.org.slug ? newSlug : undefined },
                            });
                            toast.success("Organization updated");
                            if (res.org.slug !== slug) {
                                await api("/api/me", { method: "PATCH", body: { lastOrgSlug: res.org.slug } });
                                router.replace(`/o/${res.org.slug}/settings`);
                            } else mutate();
                        } catch (err: any) {
                            setError(err.message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <FormField label="Name" htmlFor="org-name">
                        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} maxLength={64} required />
                    </FormField>
                    <FormField
                        label="URL"
                        htmlFor="org-slug"
                        error={error}
                        hint={newSlug !== data.org.slug ? "Changing this breaks existing links and API paths that use the old URL." : undefined}
                    >
                        <InputGroup>
                            <InputGroupAddon>
                                <InputGroupText className="font-mono text-[13px]">/o/</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                                id="org-slug"
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                                disabled={!isAdmin}
                                pattern="[a-z0-9][a-z0-9\-]{0,46}[a-z0-9]?"
                                className="font-mono text-[13px]"
                            />
                        </InputGroup>
                    </FormField>
                    {isAdmin && (
                        <div>
                            <Button type="submit" variant="default" loading={busy} disabled={!changed}>
                                Save changes
                            </Button>
                        </div>
                    )}
                </form>
            </Section>

            <Section
                title="Security"
                description="Turning this off never removes anyone's passkeys or authenticator apps; people who have one keep using it."
            >
                <OrgSecurity slug={slug!} isOwner={isOwner} />
            </Section>

            {!isOwner && (
                <Section title="Leave organization" description="You'll lose access to every team and project here, including through your API tokens.">
                    <Button variant="outline" onClick={() => setLeaveOpen(true)}>
                        Leave {data.org.name}
                    </Button>
                </Section>
            )}

            {isOwner && (
                <Section
                    title="Delete organization"
                    description="Permanently deletes every team, project, environment, variable, invitation and audit entry."
                >
                    <div className="flex flex-col items-start gap-3">
                        <p className="text-[13px] text-muted-foreground">
                            To leave instead, first transfer ownership to an admin from the Members tab.
                        </p>
                        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                            Delete organization
                        </Button>
                    </div>
                </Section>
            )}

            <ConfirmDialog
                open={leaveOpen}
                onOpenChange={setLeaveOpen}
                title={`Leave ${data.org.name}?`}
                description="To come back, you'll need a new invitation."
                confirmText={data.org.slug}
                actionLabel="Leave organization"
                onConfirm={async () => {
                    try {
                        await api(`/api/orgs/${slug}/members/me`, { method: "DELETE" });
                        toast.success(`You left ${data.org.name}`);
                        window.location.assign("/dashboard");
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={`Delete ${data.org.name}?`}
                description="This can't be undone. Every member loses access immediately."
                confirmText={data.org.slug}
                actionLabel="Delete organization"
                onConfirm={async (typed) => {
                    try {
                        await api(`/api/orgs/${slug}`, { method: "DELETE", body: { confirm: typed } });
                        toast.success("Organization deleted");
                        window.location.assign("/dashboard");
                    } catch (e: any) {
                        toast.error(e.message);
                    }
                }}
            />
        </div>
    );
}
