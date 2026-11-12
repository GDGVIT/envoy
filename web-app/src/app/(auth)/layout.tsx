import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthAside } from "@/components/auth/auth-aside";

/**
 * Every auth and onboarding screen: a brand panel on the left (lg and up) and the actual step on the right.
 * Below lg the panel is hidden and the step takes the full width.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid min-h-dvh bg-background lg:h-dvh lg:grid-cols-2">
            <AuthAside />
            <div className="flex min-h-dvh flex-col lg:min-h-0 lg:overflow-y-auto">
                <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 lg:justify-end">
                    <Link href="/" aria-label="Envoy home" className="lg:hidden">
                        <Logo />
                    </Link>
                    <ThemeToggle />
                </header>
                <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[6vh] sm:px-6 lg:items-center lg:py-10">
                    {/* Pages opt into a wider column with data-wide (e.g. 2FA setup). */}
                    <div className="w-full max-w-[380px] has-data-[wide=true]:max-w-[580px]">{children}</div>
                </main>
            </div>
        </div>
    );
}
