import type { Metadata } from "next";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "Page not found" };

/** Any URL that doesn't match a page. */
export default function NotFound() {
    return (
        <StatusScreen code="404" title="This page doesn't exist">
            The link may be broken, or the page may have moved. Check the address, or head back to somewhere{" "}
            <strong className="font-semibold text-foreground">familiar</strong>.
        </StatusScreen>
    );
}
