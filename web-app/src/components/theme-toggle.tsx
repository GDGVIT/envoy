"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, size = "icon" }: { className?: string; size?: "icon" | "icon-sm" }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    // The theme is only known on the client; render a neutral label until mounted to avoid a hydration mismatch.
    const dark = mounted && resolvedTheme === "dark";

    return (
        <Button
            type="button"
            variant="ghost"
            size={size}
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label={!mounted ? "Toggle theme" : dark ? "Switch to light theme" : "Switch to dark theme"}
            className={cn("text-muted-foreground", className)}
        >
            {mounted ? dark ? <Sun /> : <Moon /> : <span className="size-4" />}
        </Button>
    );
}
