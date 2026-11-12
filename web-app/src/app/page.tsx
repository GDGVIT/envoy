import { Hero, Outcomes, Statement, ToolGrid, UseCases } from "@/components/landing/sections";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";

export default function Home() {
    return (
        <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
            <SiteHeader />

            <main className="flex-1">
                {/* One continuous pastel field behind the hero, tool grid and statement. */}
                <div className="relative -mt-16 overflow-hidden">
                    <div
                        aria-hidden
                        className="absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] bg-[radial-gradient(45%_45%_at_8%_12%,oklch(0.88_0.12_70)_0%,transparent_70%),radial-gradient(40%_45%_at_50%_15%,oklch(0.86_0.07_290)_0%,transparent_70%),radial-gradient(50%_50%_at_92%_8%,oklch(0.82_0.11_245)_0%,transparent_70%),radial-gradient(70%_40%_at_75%_95%,oklch(0.9_0.06_250)_0%,transparent_75%),linear-gradient(180deg,oklch(0.95_0.03_80)_0%,oklch(0.965_0.01_240)_60%,var(--background)_100%)] dark:bg-[radial-gradient(60%_50%_at_10%_10%,oklch(0.35_0.06_70/0.6)_0%,transparent_70%),radial-gradient(55%_50%_at_90%_5%,oklch(0.35_0.07_250/0.6)_0%,transparent_70%),radial-gradient(70%_40%_at_75%_95%,oklch(0.3_0.06_250/0.5)_0%,transparent_75%),linear-gradient(180deg,oklch(0.17_0.01_250)_0%,var(--background)_100%)]"
                    />
                    <div className="relative">
                        <Hero />
                        <ToolGrid />
                        <Statement />
                    </div>
                </div>

                <Outcomes />
                <UseCases />
            </main>

            <SiteFooter />
        </div>
    );
}
