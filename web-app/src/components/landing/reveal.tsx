"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Calls back once when the element scrolls into view. */
export function useInView<T extends Element>(threshold = 0.2) {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || inView) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    io.disconnect();
                }
            },
            { threshold, rootMargin: "0px 0px -8% 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [inView, threshold]);
    return { ref, inView };
}

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({
    children,
    delay = 0,
    className,
    as: Tag = "div",
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    as?: "div" | "section" | "li";
}) {
    const { ref, inView } = useInView<HTMLDivElement>(0.15);
    return (
        <Tag
            ref={ref as any}
            data-visible={inView}
            className={cn("reveal", className)}
            style={{ ["--reveal-delay" as any]: `${delay}ms` }}
        >
            {children}
        </Tag>
    );
}
