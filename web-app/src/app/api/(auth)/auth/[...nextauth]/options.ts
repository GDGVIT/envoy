import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import connectMongo from "@/utils/connectMongo";
import User from "@/models/user";
import { isMfaEnrolled } from "@/lib/passkeys";
import { comparePassword } from "@/utils/bcrypt";
import { sanitizeFilter } from "mongoose";
import { loginLimiter, getUserIP } from "@/utils/limiter";
import { sha256 } from "@/lib/totp";

/**
 * Session lifecycle:
 *   1. Password or Google sign-in → JWT with mfaVerified=false.
 *   2. Middleware sends the user to /2fa/setup (no TOTP yet) or /2fa/verify.
 *   3. /api/2fa/* verifies the code and stores a one-time ticket on the user.
 *   4. The client calls session.update({ mfaTicket }); the jwt callback consumes the
 *      ticket and flips mfaVerified=true. Codes are never trusted from the client.
 * Bumping user.sessionVersion revokes every outstanding JWT (checked on each refresh).
 */
export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Email or username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req: any) {
                if (!credentials?.username || !credentials?.password) {
                    throw new Error("Enter your email/username and password.");
                }

                const ip = getUserIP(req);

                try {
                    await loginLimiter.consume(ip);
                    await connectMongo();

                    const identifier = String(credentials.username).trim().toLowerCase();
                    const user = await User.findOne(
                        sanitizeFilter({ $or: [{ email: identifier }, { username: identifier }] })
                    ).select("+password");

                    if (!user || !user.password) {
                        if (user && user.provider === "google") {
                            throw new Error("This account signs in with Google. Continue with Google, or set a password in Account settings first.");
                        }
                        return null;
                    }

                    const isPasswordValid = await comparePassword(credentials.password, user.password);
                    if (!isPasswordValid) return null;

                    await loginLimiter.delete(ip);

                    return {
                        id: user._id.toString(),
                        name: user.name,
                        email: user.email,
                    };
                } catch (error: any) {
                    if (error?.msBeforeNext) {
                        const retrySecs = Math.ceil(error.msBeforeNext / 1000);
                        throw new Error(`Too many login attempts. Try again in ${retrySecs}s.`);
                    }
                    throw new Error((error as Error).message || "Authentication failed");
                }
            },
        }),
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            profile: (profile) => ({
                id: profile.sub || profile.id || profile.email,
                name: profile.name || profile.email,
                email: profile.email,
                image: profile.picture,
            }),
        }),
    ],

    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },

    pages: {
        signIn: "/login",
        error: "/login",
    },

    secret: process.env.NEXTAUTH_SECRET,

    events: {
        // Signing out also ends any "reveal values" unlock (see lib/reveal).
        async signOut({ token }) {
            if (!token?.id) return;
            await connectMongo();
            await User.updateOne({ _id: token.id }, { $unset: { revealUntil: 1 } });
        },
    },

    callbacks: {
        async signIn({ account, profile }) {
            // Only accept Google accounts whose email Google has verified.
            if (account?.provider === "google") {
                return (profile as any)?.email_verified !== false;
            }
            return true;
        },

        async jwt({ token, user, account, profile, trigger, session }) {
            await connectMongo();

            // ── Fresh sign-in ──────────────────────────────────────────────
            if (account?.provider === "google") {
                const email = String(profile?.email || token.email).toLowerCase();
                const name = profile?.name || token.name || email;

                const picture = (profile as any)?.picture as string | undefined;

                let dbUser = await User.findOne({ email });
                if (!dbUser) {
                    dbUser = await User.create({ name, email, provider: "google", emailVerified: true, image: picture });
                } else if (!dbUser.emailVerified || (picture && dbUser.image !== picture)) {
                    // Keep the Google profile picture current; it changes when the user updates it in Google.
                    dbUser.emailVerified = true;
                    if (picture) dbUser.image = picture;
                    await dbUser.save();
                }

                return {
                    ...token,
                    id: dbUser._id.toString(),
                    email: dbUser.email,
                    name: dbUser.name,
                    picture: dbUser.image ?? null,
                    sv: dbUser.sessionVersion ?? 0,
                    totpEnabled: !!dbUser.totpEnabled,
                    mfaEnrolled: isMfaEnrolled(dbUser),
                    mfaVerified: false,
                    revoked: false,
                };
            }

            if (user && account?.provider === "credentials") {
                const dbUser = await User.findById(user.id).select("sessionVersion totpEnabled passkeyCount image");
                return {
                    ...token,
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: dbUser?.image ?? null,
                    sv: dbUser?.sessionVersion ?? 0,
                    totpEnabled: !!dbUser?.totpEnabled,
                    mfaEnrolled: isMfaEnrolled(dbUser),
                    mfaVerified: false,
                    revoked: false,
                };
            }

            if (!token.id || token.revoked) return token;

            // ── Refresh / update: re-check revocation and consume MFA tickets ──
            const dbUser = await User.findById(token.id).select(
                "name email image sessionVersion totpEnabled passkeyCount +mfaTicketHash +mfaTicketExpiry"
            );

            if (!dbUser || (dbUser.sessionVersion ?? 0) !== (token.sv ?? 0)) {
                return { ...token, revoked: true, mfaVerified: false };
            }

            token.name = dbUser.name;
            token.picture = dbUser.image ?? null;
            token.totpEnabled = !!dbUser.totpEnabled;
            token.mfaEnrolled = isMfaEnrolled(dbUser);
            if (!token.mfaEnrolled) token.mfaVerified = false;

            const ticket = trigger === "update" ? (session as any)?.mfaTicket : undefined;
            if (typeof ticket === "string" && dbUser.mfaTicketHash) {
                const valid =
                    sha256(ticket) === dbUser.mfaTicketHash &&
                    dbUser.mfaTicketExpiry &&
                    dbUser.mfaTicketExpiry.getTime() > Date.now();

                await User.updateOne({ _id: dbUser._id }, { $unset: { mfaTicketHash: 1, mfaTicketExpiry: 1 } });

                if (valid && token.mfaEnrolled) {
                    token.mfaVerified = true;
                }
            }

            return token;
        },

        async session({ session, token }) {
            if (token?.id) {
                session.user.id = String(token.id);
                session.user.email = token.email ?? session.user.email;
                session.user.name = token.name ?? session.user.name;
                session.user.image = (token.picture as string | null | undefined) ?? null;
                session.user.mfaVerified = !!token.mfaVerified;
                session.user.totpEnabled = !!token.totpEnabled;
                session.user.mfaEnrolled = !!token.mfaEnrolled;
                session.user.revoked = !!token.revoked;
            }
            return session;
        },
    },
};
