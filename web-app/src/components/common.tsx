"use client";

import * as React from "react";
import { Check, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/lib/format";
import { TONE_BADGE, TONE_DOT, hashTone, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Label + control + hint/error, composed from shadcn Field parts. */
export function FormField({
    label,
    hint,
    error,
    htmlFor,
    children,
    className,
}: {
    label: string;
    hint?: React.ReactNode;
    error?: string | null;
    htmlFor?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <Field data-invalid={!!error || undefined} className={className}>
            <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
            {children}
            {error ? <FieldError>{error}</FieldError> : hint ? <FieldDescription>{hint}</FieldDescription> : null}
        </Field>
    );
}

/** Search/filter box: shadcn InputGroup with a leading icon and optional shortcut hint. */
export function SearchInput({
    value,
    onChange,
    placeholder,
    label,
    shortcut,
    id,
    size = "default",
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label: string;
    shortcut?: string;
    id?: string;
    /** "sm" (32px) matches size="sm" buttons in toolbars; "default" (36px) matches inputs and selects. */
    size?: "sm" | "default";
    className?: string;
}) {
    return (
        <InputGroup className={cn("min-w-[200px] flex-1", size === "sm" && "h-8", className)}>
            <InputGroupAddon>
                <Search />
            </InputGroupAddon>
            <InputGroupInput id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
            {shortcut && (
                <InputGroupAddon align="inline-end">
                    <Kbd>{shortcut}</Kbd>
                </InputGroupAddon>
            )}
        </InputGroup>
    );
}

export function UserAvatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
    return (
        <Avatar className={cn("size-6", className)}>
            {src && <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className={cn("text-[10.5px] font-semibold", TONE_BADGE[hashTone(name ?? "?")])}>{initials(name)}</AvatarFallback>
        </Avatar>
    );
}

/** Pastel badge, e.g. roles. */
export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
    return (
        <Badge variant="outline" className={cn("border-transparent", TONE_BADGE[tone], className)}>
            {children}
        </Badge>
    );
}

/** Small solid pastel dot, e.g. before an environment name. */
export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
    return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", TONE_DOT[tone], className)} />;
}

/** Rounded square with a name's initial on its pastel tone (teams, orgs). */
export function ToneTile({ name, className }: { name: string; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold", TONE_BADGE[hashTone(name)], className)}
        >
            {name.slice(0, 1).toUpperCase()}
        </span>
    );
}

export async function copyText(text: string, label = "Copied") {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(label);
        return true;
    } catch {
        toast.error("Couldn't access the clipboard.");
        return false;
    }
}

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label ? `Copy ${label}` : "Copy"}
                    className={cn("text-muted-foreground", className)}
                    onClick={async () => {
                        if (await copyText(value, label ? `${label} copied` : "Copied")) {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1200);
                        }
                    }}
                >
                    {copied ? <Check /> : <Copy />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
        </Tooltip>
    );
}

/** Empty state composed from shadcn Empty, left-aligned to match page content. */
export function EmptyState({
    icon,
    title,
    children,
    action,
    className,
}: {
    icon?: React.ReactNode;
    title: string;
    children?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <Empty className={cn("items-start border border-dashed px-6 py-10 text-left md:p-10", className)}>
            <EmptyHeader className="items-start text-left">
                {icon && <EmptyMedia variant="icon" className="bg-pastel-mint text-pastel-mint-fg">{icon}</EmptyMedia>}
                <EmptyTitle>{title}</EmptyTitle>
                {children && <EmptyDescription className="text-left">{children}</EmptyDescription>}
            </EmptyHeader>
            {action && <EmptyContent className="items-start">{action}</EmptyContent>}
        </Empty>
    );
}

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        // Actions wrap onto their own line when the title needs the room (narrow windows, or beside the sidebar).
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 flex-[1_1_18rem]">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
                {description && <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

/** Settings-style section: title and description on the left, content on the right. */
export function Section({
    title,
    description,
    children,
    className,
    id,
}: {
    title: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    id?: string;
}) {
    return (
        <section id={id} className={cn("grid gap-6 border-t py-8 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]", className)}>
            <div>
                <h2 className="text-[15px] font-medium">{title}</h2>
                {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    );
}

/** "Load more" row under a paginated list. Renders nothing once the last page is loaded. */
export function LoadMore({ hasMore, loading, onClick, className }: { hasMore: boolean; loading?: boolean; onClick: () => void; className?: string }) {
    if (!hasMore) return null;
    return (
        <div className={cn("mt-3 flex justify-center", className)}>
            <Button variant="ghost" size="sm" onClick={onClick} loading={loading} className="text-muted-foreground">
                Load more
            </Button>
        </div>
    );
}
