import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";

export default function ShareLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            {/* Same width and left edge as the header's contents (px-2 around a max-w-6xl box with sm:px-6),
                so the page lines up with the logo like the pages inside the app. */}
            <div className="flex-1 px-2">
                <main className="mx-auto w-full max-w-6xl px-2 py-12 sm:px-6">{children}</main>
            </div>
            <SiteFooter />
        </div>
    );
}
