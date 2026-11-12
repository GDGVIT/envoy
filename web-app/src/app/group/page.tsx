import { redirect } from "next/navigation";

/** Legacy quick-share URLs (/group?token=…) now live at /share/<token>. */
export default async function LegacyGroupRedirect({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const { token } = await searchParams;
    redirect(token ? `/share/${encodeURIComponent(token)}` : "/");
}
