"use client";

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { INVITE_CODE_LENGTH, normalizeInviteToken } from "@/lib/invite-code";

const slotClass = "h-11 flex-1 font-mono text-base uppercase data-[active=true]:z-10";

/**
 * 10-character invite code input, shown as two groups of five (XXXXX-XXXXX).
 * Typing is uppercased; pasting a code with a dash, or a whole /invite/<code> link, fills it in.
 */
export function InviteCodeField({
    value,
    onChange,
    onComplete,
    disabled,
    invalid,
    autoFocus,
}: {
    value: string;
    onChange: (v: string) => void;
    onComplete?: (v: string) => void;
    disabled?: boolean;
    invalid?: boolean;
    autoFocus?: boolean;
}) {
    return (
        <InputOTP
            maxLength={INVITE_CODE_LENGTH}
            value={value}
            onChange={(v) => onChange(v.toUpperCase())}
            onComplete={(v: string) => onComplete?.(v.toUpperCase())}
            pasteTransformer={(pasted) => normalizeInviteToken(pasted).slice(0, INVITE_CODE_LENGTH)}
            pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            aria-label="Invite code"
            aria-invalid={invalid || undefined}
            containerClassName="w-full gap-2"
        >
            <InputOTPGroup className="flex-1">
                {[0, 1, 2, 3, 4].map((i) => (
                    <InputOTPSlot key={i} index={i} aria-invalid={invalid || undefined} className={slotClass} />
                ))}
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup className="flex-1">
                {[5, 6, 7, 8, 9].map((i) => (
                    <InputOTPSlot key={i} index={i} aria-invalid={invalid || undefined} className={slotClass} />
                ))}
            </InputOTPGroup>
        </InputOTP>
    );
}
