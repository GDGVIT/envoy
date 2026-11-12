import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const REPO = "https://github.com/GDGVIT/envoy";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Envoy";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "/#features" },
            { label: "Temporary link", href: "/share" },
            { label: "Sign in", href: "/login" },
        ],
    },
    {
        title: "Project",
        links: [
            { label: "Source code", href: REPO, external: true },
            { label: "Report an issue", href: `${REPO}/issues`, external: true },
            { label: "Contributing", href: `${REPO}/blob/dev/contributing.md`, external: true },
        ],
    },
];

function FooterLink({ href, external, className, children }: { href: string; external?: boolean; className?: string; children: React.ReactNode }) {
    return external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
        </a>
    ) : (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}

/** Brand-green inset panel: links and a GitHub call to action, then the name and credit. */
export function SiteFooter() {
    return (
        <footer className="mt-auto p-2">
            <div className="rounded-lg bg-primary text-white">
                <div className="mx-auto max-w-6xl px-6 pb-10 pt-14 sm:px-10">
                    {/* Links and the GitHub call to action */}
                    <div className="flex flex-col gap-12 md:flex-row md:justify-between">
                        <div className="flex gap-16 sm:gap-24">
                            {COLUMNS.map((col) => (
                                <nav key={col.title} aria-label={col.title}>
                                    <p className="mb-4 text-[11.5px] font-medium tracking-[0.08em] text-white/70">{col.title.toUpperCase()}</p>
                                    <ul className="flex flex-col gap-2.5">
                                        {col.links.map((l) => (
                                            <li key={l.label}>
                                                <FooterLink href={l.href} external={l.external} className="text-[14px] text-white/90 transition-colors hover:text-white">
                                                    {l.label}
                                                </FooterLink>
                                            </li>
                                        ))}
                                    </ul>
                                </nav>
                            ))}
                        </div>

                        <div className="md:max-w-sm md:text-right">
                            <a
                                href={REPO}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-2 text-[2.1rem] font-normal leading-none tracking-[-0.035em] text-white sm:text-[2.6rem]"
                            >
                                Star it on GitHub
                                <ArrowUpRight className="size-7 text-white/75 transition-colors group-hover:text-white" />
                            </a>
                            <p className="mt-4 text-[13.5px] leading-relaxed text-white/80">
                                <strong className="font-semibold text-white">Open to contributions.</strong> Bug fixes, new features and typo
                                fixes are all welcome.
                            </p>
                        </div>
                    </div>

                    <div className="my-10 h-px bg-white/20" />

                    {/* Name and credit */}
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <p className="text-[4.5rem] font-medium leading-[0.85] tracking-[-0.055em] text-white sm:text-[6.5rem]">{APP_NAME}</p>
                        <p className="pb-1 text-[12.5px] text-white/75">
                            © {new Date().getFullYear()} ·{" "}
                            <a href="https://www.dscvit.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:underline hover:underline-offset-4">
                                GDG VIT
                            </a>{" "}
                            · Open source under GPL-3.0
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
