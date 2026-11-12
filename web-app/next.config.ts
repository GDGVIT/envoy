import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-only Next.js indicator away from the sidebar account menu (bottom-left).
  devIndicators: { position: "bottom-right" },
  // Loaded by Node at runtime instead of bundled: the package lists optional storage backends
  // (e.g. drizzle-orm) that Envoy doesn't use, and bundling it fails to resolve them.
  serverExternalPackages: ["rate-limiter-flexible"],
};

export default nextConfig;
