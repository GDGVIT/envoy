import mongoose, { Schema } from "mongoose";

/**
 * A WebAuthn credential (passkey) registered by a user. Only the public key is stored; the private key
 * never leaves the user's device or password manager.
 */
const passkeySchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        /** base64url credential ID, as the browser reports it. */
        credentialId: { type: String, required: true, unique: true },
        /** base64url COSE public key. */
        publicKey: { type: String, required: true },
        /** Signature counter, to spot cloned authenticators (0 for most synced passkeys). */
        counter: { type: Number, default: 0 },
        transports: { type: [String], default: [] },
        /** "multiDevice" for synced passkeys (iCloud Keychain, Google Password Manager, 1Password…). */
        deviceType: { type: String },
        backedUp: { type: Boolean, default: false },
        name: { type: String, required: true, trim: true, maxlength: 64 },
        lastUsedAt: { type: Date },
    },
    { timestamps: true }
);

const Passkey = mongoose.models.Passkey || mongoose.model("Passkey", passkeySchema);
export default Passkey;
