import { cn } from "@/lib/utils";

/** Envoy mark drawn with theme tokens so it inverts cleanly between light and dark. */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 90 90" aria-hidden className={cn("size-6", className)}>
            <rect width="90" height="90" rx="19.85" fill="var(--foreground)" />
            <g fill="var(--background)">
                <rect x="20.51" y="23.16" width="7.5" height="41.56" />
                <rect x="20.51" y="23.16" width="48.4" height="8.03" />
                <rect x="61.42" y="23.16" width="7.5" height="41.56" />
                <path d="M40.07 28.19 48.14 28.06 31.23 64.76 22.24 64.91Z" />
                <path d="M49.3 28.26H41.22L58.72 64.69H67.72Z" />
            </g>
        </svg>
    );
}

export function Logo({ className }: { className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground", className)}>
            <LogoMark />
            {process.env.NEXT_PUBLIC_APP_NAME || "Envoy"}
        </span>
    );
}

export function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
    );
}
