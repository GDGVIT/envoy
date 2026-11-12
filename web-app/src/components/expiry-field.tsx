"use client";

import { DatePicker, toISODate } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/common";

const DAY = 24 * 60 * 60 * 1000;

export type Expiry = { preset: string; date: string };

/**
 * Expiry choice: preset durations (days, or "never" when allowed) plus "Custom date…", which reveals the
 * calendar date picker limited to tomorrow through `maxDays` ahead.
 */
export function ExpiryField({
    id,
    label = "Expires",
    value,
    onChange,
    presets,
    maxDays,
}: {
    id: string;
    label?: string;
    value: Expiry;
    onChange: (v: Expiry) => void;
    presets: { value: string; label: string }[];
    maxDays: number;
}) {
    const minDate = new Date(Date.now() + DAY);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(Date.now() + maxDays * DAY);
    maxDate.setHours(0, 0, 0, 0);
    const min = toISODate(minDate);
    return (
        <FormField label={label} htmlFor={id}>
            <div className="flex flex-col gap-2">
                <Select value={value.preset} onValueChange={(preset) => onChange({ preset, date: value.date || min })}>
                    <SelectTrigger id={id} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {presets.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                                {p.label}
                            </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom date…</SelectItem>
                    </SelectContent>
                </Select>
                {value.preset === "custom" && (
                    <DatePicker
                        aria-label="Expiry date"
                        value={value.date}
                        min={minDate}
                        max={maxDate}
                        onChange={(date) => onChange({ ...value, date })}
                    />
                )}
            </div>
        </FormField>
    );
}

/** The end of the chosen day, in the user's time zone, as an ISO timestamp for the API. */
export function customExpiryISO(date: string) {
    return new Date(`${date}T23:59:59`).toISOString();
}
