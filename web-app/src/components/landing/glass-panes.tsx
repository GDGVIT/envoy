"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./motion";

const SKEW_DEG = 20;
/** Rows of panes visible in each column (three diagonal bands, like the reference). */
const ROWS = 3;
const TAN = Math.tan((SKEW_DEG * Math.PI) / 180);

/** Panes fade out between these heights, as % of the container. */
const FADE_FROM = 28;
const FADE_TO = 96;
const alphaAt = (y: number) => Math.min(1, Math.max(0, 1 - (y - FADE_FROM) / (FADE_TO - FADE_FROM)));

type Pane = { key: string; left: number; top: number; layer: "front" | "back"; delay: number; fade: string };

/**
 * Layered frosted glass, laid out like a sheared grid:
 *  - Wide, short panes in columns with a narrow gap between them.
 *  - The whole grid is sheared (skewY), so vertical edges stay vertical and the top and bottom
 *    edges run as long diagonals descending to the right.
 *  - Neighbouring columns are offset by half a row.
 *  - A fainter back layer, offset half a column and half a row, sits behind the front panes:
 *    it shows through the gaps and under the front panes' corners, which gives the overlap and depth.
 * Each pane blurs what is behind it. Moving the pointer over the parent shifts the front layer more
 * than the back layer (parallax) and tilts the stack.
 *
 * `aspect` is the container's width ÷ height, used only to place the fade-out where it lands on screen.
 */
export function GlassPanes({ cols = 5, aspect = 2.1, className }: { cols?: number; aspect?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const el = ref.current;
        const host = el?.parentElement;
        if (!el || !host || reduced) return;

        let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
        const tick = () => {
            x += (tx - x) * 0.07;
            y += (ty - y) * 0.07;
            el.style.setProperty("--px", x.toFixed(4));
            el.style.setProperty("--py", y.toFixed(4));
            raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.0005 ? requestAnimationFrame(tick) : 0;
        };
        const kick = () => {
            if (!raf) raf = requestAnimationFrame(tick);
        };
        const onMove = (e: PointerEvent) => {
            const r = host.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
            ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
            kick();
        };
        const onLeave = () => {
            tx = 0;
            ty = 0;
            kick();
        };
        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerleave", onLeave);
        return () => {
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerleave", onLeave);
            cancelAnimationFrame(raf);
        };
    }, [reduced]);

    // Grid in the unsheared frame, in % of the container.
    const pitch = 100 / cols;
    const width = pitch * 0.84; // gap between columns = 16% of the pitch
    const rowPitch = 46;
    const height = 34;
    const drop = TAN * aspect; // how far (in % of height) the shear pushes a pane down per 1% of width

    const panes: Pane[] = [];
    for (const layer of ["back", "front"] as const) {
        for (let c = -1; c <= cols; c++) {
            const left = c * pitch + (layer === "back" ? pitch / 2 : 0);
            // Front columns alternate by half a row. A back pane bridges two front columns, so it sits
            // halfway between their offsets: inside the same band, never forming bands of its own.
            const colOffset = layer === "back" ? rowPitch / 4 : (((c % 2) + 2) % 2) * (rowPitch / 2);
            // Exactly three rows per column: start at the first row that shows at the top once sheared.
            let shown = 0;
            for (let r = -8; r <= 6 && shown < ROWS; r++) {
                const top = r * rowPitch + colOffset;
                // Where the pane lands on screen once sheared; skip panes that land above or below the container.
                const screenTop = top + (left + width / 2) * drop;
                if (screenTop + height < 0 || screenTop > 100) continue;
                shown++;
                const fade = `linear-gradient(to bottom, rgb(0 0 0 / ${alphaAt(screenTop).toFixed(2)}), rgb(0 0 0 / ${alphaAt(screenTop + height).toFixed(2)}))`;
                panes.push({ key: `${layer}-${c}-${r}`, left, top, layer, delay: 120 + Math.max(0, c) * 90, fade });
            }
        }
    }

    return (
        <div ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 overflow-hidden", className)}>
            <div
                className="absolute inset-0"
                style={{ transform: "perspective(1400px) rotateY(calc(var(--px, 0) * 3deg)) rotateX(calc(var(--py, 0) * -2deg))" }}
            >
                {/* The sheared grid. */}
                <div className="absolute inset-0 origin-top-left" style={{ transform: `skewY(${SKEW_DEG}deg)` }}>
                    {panes.map((p) => {
                        const depth = p.layer === "front" ? 1 : 0.45;
                        return (
                            <div
                                key={p.key}
                                className="absolute animate-rise"
                                style={{
                                    left: `${p.left}%`,
                                    top: `${p.top}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                    zIndex: p.layer === "front" ? 2 : 1,
                                    animationDelay: `${p.delay}ms`,
                                }}
                            >
                                <div
                                    className={cn(
                                        "size-full",
                                        p.layer === "front"
                                            ? "border-t border-white/70 bg-[linear-gradient(to_bottom,rgb(255_255_255/0.55),rgb(255_255_255/0.12))] backdrop-blur-md dark:border-white/[0.1] dark:bg-[linear-gradient(to_bottom,rgb(255_255_255/0.09),rgb(255_255_255/0.015))]"
                                            : "bg-[linear-gradient(to_bottom,rgb(255_255_255/0.18),rgb(255_255_255/0.02))] dark:bg-[linear-gradient(to_bottom,rgb(255_255_255/0.035),rgb(255_255_255/0.003))]"
                                    )}
                                    style={{
                                        transform: `translate3d(calc(var(--px, 0) * ${24 * depth}px), calc(var(--py, 0) * ${14 * depth}px), 0)`,
                                        maskImage: p.fade,
                                        WebkitMaskImage: p.fade,
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/** The pastel field behind the auth panel. */
export const PASTEL_FIELD =
    "bg-[radial-gradient(60%_50%_at_10%_10%,oklch(0.93_0.09_75)_0%,transparent_70%),radial-gradient(55%_50%_at_90%_5%,oklch(0.88_0.07_245)_0%,transparent_70%),radial-gradient(70%_40%_at_75%_95%,oklch(0.9_0.06_250)_0%,transparent_75%),linear-gradient(180deg,oklch(0.97_0.02_80)_0%,oklch(0.965_0.01_240)_100%)] dark:bg-[radial-gradient(60%_50%_at_10%_10%,oklch(0.35_0.06_70/0.6)_0%,transparent_70%),radial-gradient(55%_50%_at_90%_5%,oklch(0.35_0.07_250/0.6)_0%,transparent_70%),radial-gradient(70%_40%_at_75%_95%,oklch(0.3_0.06_250/0.5)_0%,transparent_75%),linear-gradient(180deg,oklch(0.17_0.01_250)_0%,oklch(0.16_0.008_250)_100%)]";
