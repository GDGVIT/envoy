"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { CloudAlert, Copy, Download, Eye, EyeOff, RotateCcw, SearchX, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, copyText } from "@/components/common";
import { StateBlock } from "@/components/app/states";
import { VarTable, nextRowId, useRowProblems, type Row } from "@/components/app/var-table";
import { ApiError, fetcher } from "@/lib/api-client";
import { stringifyDotenv } from "@/lib/dotenv";
import { formatDate, timeAgo } from "@/lib/format";

type Share = { expiresAt: string; vars: { key: string; value: string }[] };

const newLink = (
    <Button asChild variant="outline">
        <Link href="/share">Create a new link</Link>
    </Button>
);

export default function SharedVariablesPage() {
    const { token } = useParams<{ token: string }>();
    const { data, error, mutate, isValidating } = useSWR<Share>(`/api/share/${token}`, fetcher, { revalidateOnFocus: false });
    const [revealAll, setRevealAll] = useState(false);
    const [revealed, setRevealed] = useState<Set<string>>(new Set());

    const rows: Row[] = useMemo(() => (data?.vars ?? []).map((v) => ({ id: nextRowId(), key: v.key, value: v.value, origKey: v.key })), [data]);
    const { keyCounts } = useRowProblems(rows);

    // When the link runs out while the page is open, ask again: the server deletes it and answers "expired".
    useEffect(() => {
        if (!data) return;
        const ms = new Date(data.expiresAt).getTime() - Date.now();
        const t = setTimeout(() => mutate(), Math.max(0, ms) + 500);
        return () => clearTimeout(t);
    }, [data, mutate]);

    if (error) {
        const status = error instanceof ApiError ? error.status : 0;
        if (status === 410) {
            const expiredAt = (error as ApiError).data?.expiredAt as string | undefined;
            return (
                <StateBlock contained={false} icon={Timer} tone="bg-pastel-lemon text-pastel-lemon-fg" title="This link has expired" actions={newLink}>
                    {expiredAt ? (
                        <>
                            It expired <span title={formatDate(expiredAt)}>{timeAgo(expiredAt)}</span>, and the variables in it were{" "}
                            <strong className="font-semibold text-foreground">permanently deleted</strong>.
                        </>
                    ) : (
                        <>
                            Its time ran out, and the variables in it were <strong className="font-semibold text-foreground">permanently deleted</strong>.
                        </>
                    )}{" "}
                    Ask the sender for a new link.
                </StateBlock>
            );
        }
        if (status === 404) {
            return (
                <StateBlock contained={false} icon={SearchX} tone="bg-pastel-sky text-pastel-sky-fg" title="Link not found" actions={newLink}>
                    There&apos;s no shared link at this address. Check that it was <strong className="font-semibold text-foreground">copied in full</strong>.
                </StateBlock>
            );
        }
        return (
            <StateBlock
                contained={false}
                icon={CloudAlert}
                tone="bg-pastel-rose text-pastel-rose-fg"
                title="Couldn't open this link"
                actions={
                    <Button onClick={() => mutate()} loading={isValidating}>
                        <RotateCcw /> Try again
                    </Button>
                }
            >
                Something went wrong on our side or with your connection. The link itself may still work.
            </StateBlock>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="mb-6 h-8 w-64" />
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                ))}
            </div>
        );
    }

    const dotenv = stringifyDotenv(data.vars);
    const download = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([dotenv], { type: "text/plain" }));
        a.download = ".env";
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <>
            <PageHeader
                title="Shared variables"
                description={
                    <>
                        Someone shared <strong className="font-semibold text-foreground">{data.vars.length} variable{data.vars.length === 1 ? "" : "s"}</strong> with you.{" "}
                        <span title={formatDate(data.expiresAt)}>This link expires {timeAgo(data.expiresAt)}</span>, then it&apos;s deleted.
                    </>
                }
            />

            {/* Same toolbar and table as an environment in the app, read-only. */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRevealAll((r) => !r)} aria-pressed={revealAll}>
                    {revealAll ? <EyeOff /> : <Eye />} {revealAll ? "Hide values" : "Reveal values"}
                </Button>
                <ButtonGroup>
                    <Button size="sm" variant="outline" onClick={() => copyText(dotenv, `Copied ${data.vars.length} variables`)}>
                        <Copy /> Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={download}>
                        <Download /> Download
                    </Button>
                </ButtonGroup>
            </div>
            <VarTable
                rows={rows}
                canEdit={false}
                keyCounts={keyCounts}
                revealAll={revealAll}
                revealed={revealed}
                onUpdate={() => {}}
                onRemove={() => {}}
                onAdd={() => {}}
                onToggleReveal={(row, reveal) =>
                    setRevealed((s) => {
                        const n = new Set(s);
                        if (reveal) n.add(row.id);
                        else n.delete(row.id);
                        return n;
                    })
                }
                onCopy={(row) => row.value !== null && copyText(row.value, `Copied ${row.key}`)}
            />
            <p className="mt-4 text-[13px] text-muted-foreground">Copy these into your own .env file. The link stops working when it expires.</p>
        </>
    );
}
