"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const on = () => setReduced(mq.matches);
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);
    return reduced;
}

/** Headline whose words rise in one after another, unblurring as they land. */
export function WordReveal({
    lines,
    className,
    delay = 0,
    step = 70,
}: {
    lines: { text: string; className?: string }[][];
    className?: string;
    delay?: number;
    step?: number;
}) {
    let i = 0;
    return (
        <span className={className}>
            {lines.map((line, li) => (
                <span key={li} className="block">
                    {line.map((seg, si) =>
                        seg.text.split(" ").map((word, wi) => {
                            const d = delay + i++ * step;
                            return (
                                <span
                                    key={`${si}-${wi}`}
                                    className={cn("inline-block animate-word-in", seg.className)}
                                    style={{ animationDelay: `${d}ms` }}
                                >
                                    {word}
                                    {" "}
                                </span>
                            );
                        })
                    )}
                </span>
            ))}
        </span>
    );
}

/** Infinite horizontal marquee. Children are rendered twice for a seamless loop. */
export function Marquee({
    children,
    duration = 40,
    reverse = false,
    className,
}: {
    children: React.ReactNode;
    duration?: number;
    reverse?: boolean;
    className?: string;
}) {
    return (
        <div className={cn("marquee", className)} data-reverse={reverse} style={{ ["--marquee-duration" as any]: `${duration}s` }}>
            <div className="marquee-track">
                <div className="flex shrink-0 items-center">{children}</div>
                <div className="flex shrink-0 items-center" aria-hidden>
                    {children}
                </div>
            </div>
        </div>
    );
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** 0 → 1 as an element travels from entering the bottom of the viewport to its centre reaching ~40% from the top. */
export function useScrollProgress<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [progress, setProgress] = useState(0);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        if (reduced) {
            setProgress(1);
            return;
        }
        let raf = 0;
        const measure = () => {
            raf = 0;
            const el = ref.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const vh = window.innerHeight;
            setProgress(clamp((vh - r.top) / (vh * 0.6 + r.height * 0.5)));
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(measure);
        };
        measure();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            cancelAnimationFrame(raf);
        };
    }, [reduced]);

    return { ref, progress };
}
