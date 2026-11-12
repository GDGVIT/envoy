import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import AuthSessionProvider from "@/providers/SessionProvider";
import { ThemeProvider } from "@/providers/MyThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: { default: "Envoy: environment variables for teams", template: "%s | Envoy" },
  description:
    "Store, share and fetch environment variables across your organization, with per-team access, two-factor sign-in and an audit log.",
  icons: { icon: "/assets/envoy-logo.svg", apple: "/assets/envoy-logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthSessionProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster position="bottom-right" />
            </TooltipProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
