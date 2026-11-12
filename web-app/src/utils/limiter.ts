import { RateLimiterMemory } from "rate-limiter-flexible";

export function getUserIP(req: any): string {
  const headers = req?.headers ?? {};

  // NextRequest exposes a Headers instance; NextAuth's authorize() passes a plain object.
  const xForwardedFor =
    typeof headers.get === "function"
      ? headers.get("x-forwarded-for")
      : headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  const ip = Array.isArray(xForwardedFor)
    ? xForwardedFor[0]
    : xForwardedFor?.split(",")[0]?.trim();

  return ip || "127.0.0.1";
}

export const generalLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1,
});

export const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 60 * 5,
});

// Per-user limiter for 2FA code attempts (5 tries, then 5 minute lockout).
export const mfaLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 5,
  blockDuration: 60 * 5,
});
