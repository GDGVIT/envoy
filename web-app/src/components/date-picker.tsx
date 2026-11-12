"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** "2026-11-08" ⇄ a local Date, so values never shift a day across time zones. */
export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromISODate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : undefined;
};

/**
 * Date field: a button showing the chosen day that opens the calendar in a popover. Values are
 * "YYYY-MM-DD" strings; `min`/`max` limit the selectable days.
 */
export function DatePicker({
    id,
    value,
    onChange,
    min,
    max,
    placeholder = "Pick a date",
    className,
    "aria-label": ariaLabel,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    min?: Date;
    max?: Date;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = value ? fromISODate(value) : undefined;
    const label = selected?.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    aria-label={ariaLabel}
                    className={cn("w-full justify-start gap-2 font-normal", !selected && "text-muted-foreground", className)}
                >
                    <CalendarIcon className="text-muted-foreground" />
                    {label ?? placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected ?? min}
                    startMonth={min}
                    endMonth={max}
                    disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
                    onSelect={(d) => {
                        if (!d) return;
                        onChange(toISODate(d));
                        setOpen(false);
                    }}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    );
}
