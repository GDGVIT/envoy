import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const allowedOrigins = [process.env.NEXTAUTH_URL, "http://localhost:3000"];

const AUTH_PAGES = ["/login", "/signup"];
// Pages that require a signed-in, 2FA-verified user.
const PROTECTED_PREFIXES = ["/dashboard", "/o/", "/account", "/onboarding"];
const SESSION_COOKIES = ["next-auth.session-token", "__Secure-next-auth.session-token"];

function redirect(request: NextRequest, path: string, withCallback = false) {
    const url = new URL(path, request.url);
    if (withCallback) {
        const { pathname, search } = request.nextUrl;
        url.searchParams.set("callbackUrl", pathname + search);
    }
    return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/api")) {
        const origin = request.headers.get("origin") || "";
        const response = NextResponse.next();

        if (allowedOrigins.includes(origin)) {
            response.headers.set("Access-Control-Allow-Origin", origin);
        }
        response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (request.method === "OPTIONS") {
            return new NextResponse(null, { status: 204, headers: response.headers });
        }
        return response;
    }

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
    const isAuthPage = AUTH_PAGES.includes(pathname);
    const isSetup = pathname === "/2fa/setup";
    const isVerify = pathname === "/2fa/verify";

    if (token?.revoked) {
        const response = redirect(request, "/login?error=SessionRevoked");
        SESSION_COOKIES.forEach((name) => response.cookies.delete(name));
        return response;
    }

    if (!token) {
        if (isProtected || isSetup || isVerify) return redirect(request, "/login", isProtected);
        return NextResponse.next();
    }

    const enrolled = token.mfaEnrolled ?? token.totpEnabled;

    // No second factor: that's allowed (organizations decide whether they require one; the API enforces it).
    // Setup stays reachable so people can add one; there's nothing to verify.
    if (!enrolled) {
        if (isVerify || isAuthPage) return redirect(request, "/dashboard");
        return NextResponse.next();
    }

    // Has a passkey or authenticator, but this session hasn't passed the second step yet.
    if (!token.mfaVerified) {
        if (isVerify) return NextResponse.next();
        if (isProtected || isAuthPage || isSetup) return redirect(request, "/2fa/verify", isProtected);
        return NextResponse.next();
    }

    // Already enrolled and verified: more passkeys or an authenticator app are added from Account settings.
    if (isSetup) return redirect(request, "/account#two-factor");
    if (isAuthPage || isVerify) return redirect(request, "/dashboard");

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/o/:path*",
        "/account/:path*",
        "/onboarding",
        "/login",
        "/signup",
        "/2fa/:path*",
        "/api/:path*",
    ],
};
