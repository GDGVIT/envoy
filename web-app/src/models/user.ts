import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            unique: true,
            required: function (this: any) {
                return this.provider === "credentials";
            },
            sparse: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Basic email regex
        },
        password: {
            type: String,
            required: function (this: any) {
                return this.provider === "credentials";
            },
            select: false,
        },
        provider: {
            type: String,
            default: "credentials",
            enum: ["credentials", "google"],
        },
        image: {
            type: String,
        },
        emailVerified: { type: Boolean, default: false },
        // TOTP two-factor auth. Secrets are stored encrypted with utils/encryption.
        totpEnabled: { type: Boolean, default: false },
        totpSecret: { type: String, select: false },
        totpPendingSecret: { type: String, select: false },
        totpLastStep: { type: Number, select: false },
        backupCodes: { type: [String], select: false, default: [] },
        // Passkeys (WebAuthn) are the other second factor; the credentials live in the Passkey collection.
        // passkeyCount mirrors it so "has 2FA set up" needs no extra query on every request.
        passkeyCount: { type: Number, default: 0 },
        // The one in-flight WebAuthn challenge (registration or sign-in), single use, a few minutes long.
        webauthnChallenge: { type: String, select: false },
        webauthnChallengeExpiry: { type: Date, select: false },
        // One-time ticket minted by /api/2fa/* after a code is verified; the NextAuth
        // jwt callback consumes it to mark the session as MFA-verified.
        mfaTicketHash: { type: String, select: false },
        mfaTicketExpiry: { type: Date, select: false },
        // Until when this user may see secret values (set by confirming a TOTP code; see lib/reveal).
        // Kept server-side only, so it can't be forged or replayed from the browser.
        revealUntil: { type: Date, select: false },
        // Bumped to invalidate every outstanding session (2FA reset, password change, sign out everywhere).
        sessionVersion: { type: Number, default: 0 },
        lastOrgSlug: { type: String },
        passwordResetToken: String,
        tokenExpiry: Date,
    },
    {
        timestamps: true,
    }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
