"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
    { href: "/#features", label: "Features" },
    { href: "/share", label: "Temporary link" },
];

export function SiteHeader() {
    const { data: session, status } = useSession();
    const signedIn = !!session?.user?.mfaVerified;
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        // Floating bar: an even 8px gap above and at the sides, rounded like the rest of the UI.
        // Total height stays 64px (pt-2 + h-14) so the hero can tuck under it with -mt-16.
        <header className="pointer-events-none sticky top-0 z-30 px-2 pt-2">
            <div
                className={cn(
                    "pointer-events-auto mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-lg px-2 ring-1 transition-[background-color,box-shadow,backdrop-filter] duration-300 sm:px-6",
                    scrolled ? "bg-background/75 ring-border backdrop-blur-md" : "bg-transparent ring-transparent"
                )}
            >
                <Link href="/" aria-label="Envoy home" className="mr-auto">
                    <Logo />
                </Link>
                <nav className="mr-2 hidden items-center gap-0.5 md:flex" aria-label="Site">
                    {LINKS.map((l) => (
                        <Button key={l.href} asChild variant="ghost" size="sm" className="text-muted-foreground">
                            <Link href={l.href}>{l.label}</Link>
                        </Button>
                    ))}
                </nav>
                <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="icon-sm" aria-label="Envoy on GitHub" className="hidden text-muted-foreground sm:inline-flex">
                        <a href="https://github.com/GDGVIT/envoy" target="_blank" rel="noopener noreferrer">
                            <Github />
                        </a>
                    </Button>
                    <ThemeToggle size="icon-sm" />
                    {status !== "loading" &&
                        (signedIn ? (
                            <Button asChild size="sm" className="px-4">
                                <Link href="/dashboard">Open dashboard</Link>
                            </Button>
                        ) : (
                            <>
                                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                                    <Link href="/login">Sign in</Link>
                                </Button>
                                <Button asChild size="sm" className="px-4">
                                    <Link href="/signup">Get started</Link>
                                </Button>
                            </>
                        ))}
                </div>
            </div>
        </header>
    );
}
