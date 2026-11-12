"use client";

import { useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, Search } from "lucide-react";
import { UserAvatar } from "@/components/common";
import { cn } from "@/lib/utils";

export type PickablePerson = {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    /** Shown on the right, e.g. a role badge. */
    badge?: React.ReactNode;
    /** Shown instead of the email's second half, e.g. "admin, always has access". */
    note?: string;
    /** Can't be toggled (stays as `checked` says). */
    locked?: boolean;
};

/** Name or email contains the query (cmdk's default is fuzzy, which matches scattered letters). */
const matches = (value: string, search: string, keywords?: string[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return 1;
    return (keywords ?? [value]).some((k) => k.toLowerCase().includes(q)) ? 1 : 0;
};

/**
 * Searchable list of people: type to filter by name or email, arrow keys to move, Enter or click to pick.
 * `single` picks one person (radio-like); `multi` toggles checkboxes.
 */
export function PeoplePicker({
    people,
    mode,
    isChecked,
    onPick,
    placeholder = "Search by name or email",
    emptyText = "No one to choose from.",
    autoFocus,
    className,
}: {
    people: PickablePerson[];
    mode: "single" | "multi";
    isChecked: (id: string) => boolean;
    /** single: the person picked; multi: the person toggled. */
    onPick: (id: string) => void;
    placeholder?: string;
    emptyText?: string;
    autoFocus?: boolean;
    className?: string;
}) {
    const [query, setQuery] = useState("");

    if (!people.length) {
        return <p className="rounded-lg bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">{emptyText}</p>;
    }

    return (
        <CommandPrimitive filter={matches} loop className={cn("overflow-hidden rounded-lg ring-1 ring-border", className)}>
            <div className="flex items-center gap-2 border-b px-3">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <CommandPrimitive.Input
                    value={query}
                    onValueChange={setQuery}
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    data-people-search=""
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />
            </div>
            <CommandPrimitive.List className="max-h-60 overflow-y-auto p-1">
                <CommandPrimitive.Empty className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                    No one matches &ldquo;{query.trim()}&rdquo;.
                </CommandPrimitive.Empty>
                {people.map((p) => {
                    const checked = isChecked(p.id);
                    return (
                        <CommandPrimitive.Item
                            key={p.id}
                            value={p.id}
                            keywords={[p.name, p.email]}
                            disabled={p.locked}
                            onSelect={() => onPick(p.id)}
                            aria-checked={checked}
                            role={mode === "single" ? "radio" : "checkbox"}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 outline-none data-[disabled=true]:cursor-default data-[selected=true]:bg-muted"
                        >
                            {mode === "multi" ? (
                                <span
                                    aria-hidden
                                    className={cn(
                                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                                        checked ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25",
                                        p.locked && "opacity-60"
                                    )}
                                >
                                    {checked && <Check className="size-3" />}
                                </span>
                            ) : null}
                            <UserAvatar name={p.name} src={p.image ?? null} className="size-7" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">{p.note ? `${p.email} · ${p.note}` : p.email}</span>
                            </span>
                            {p.badge}
                            {mode === "single" && <Check aria-hidden className={cn("size-4 shrink-0 text-primary", !checked && "invisible")} />}
                        </CommandPrimitive.Item>
                    );
                })}
            </CommandPrimitive.List>
        </CommandPrimitive>
    );
}
