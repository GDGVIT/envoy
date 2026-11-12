"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

const slotClass = "h-12 flex-1 font-mono text-lg data-[active=true]:z-10";

/**
 * Six-digit TOTP code input (shadcn InputOTP), stretched to the width of its container so it
 * lines up with the full-width button below it. Supports paste and one-time-code autofill.
 */
export function OtpField({
    value,
    onChange,
    onComplete,
    disabled,
    invalid,
}: {
    value: string;
    onChange: (v: string) => void;
    onComplete?: (v: string) => void;
    disabled?: boolean;
    invalid?: boolean;
}) {
    return (
        <InputOTP
            maxLength={6}
            value={value}
            onChange={onChange}
            onComplete={onComplete}
            disabled={disabled}
            autoFocus
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="6-digit code"
            aria-invalid={invalid || undefined}
            containerClassName="w-full gap-3"
        >
            <InputOTPGroup className="flex-1">
                {[0, 1, 2].map((i) => (
                    <InputOTPSlot key={i} index={i} aria-invalid={invalid || undefined} className={slotClass} />
                ))}
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup className="flex-1">
                {[3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} aria-invalid={invalid || undefined} className={slotClass} />
                ))}
            </InputOTPGroup>
        </InputOTP>
    );
}
