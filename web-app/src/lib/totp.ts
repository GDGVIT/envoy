import "server-only";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { createHash, randomBytes } from "crypto";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME || "Envoy";
const PERIOD = 30;

export function generateTotpSecret() {
    return new Secret({ size: 20 }).base32;
}

function buildTotp(secretBase32: string, label = "account") {
    return new TOTP({
        issuer: ISSUER,
        label,
        algorithm: "SHA1",
        digits: 6,
        period: PERIOD,
        secret: Secret.fromBase32(secretBase32),
    });
}

export function totpUri(secretBase32: string, label: string) {
    return buildTotp(secretBase32, label).toString();
}

export async function totpQrDataUrl(uri: string) {
    return QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#000000", light: "#ffffff" } });
}

/**
 * Verifies a code within ±1 step. Returns the matched time step, or null when the
 * code is wrong or was already used (step <= lastStep), preventing replay.
 */
export function verifyTotp(secretBase32: string, code: string, lastStep?: number | null): number | null {
    const delta = buildTotp(secretBase32).validate({ token: code, window: 1 });
    if (delta === null) return null;
    const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
    if (typeof lastStep === "number" && step <= lastStep) return null;
    return step;
}

const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function sha256(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeBackupCode(code: string) {
    return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** 10 codes like `k7d2m-q9xpa` (~50 bits each). Stored as sha256 hashes. */
export function generateBackupCodes(count = 10) {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const bytes = randomBytes(10);
        let raw = "";
        for (const b of bytes) raw += BACKUP_ALPHABET[b % BACKUP_ALPHABET.length];
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
    }
    return { codes, hashes: codes.map((c) => sha256(normalizeBackupCode(c))) };
}

/** Returns the remaining hashes if the code matched, otherwise null. */
export function consumeBackupCode(hashes: string[], code: string): string[] | null {
    const hash = sha256(normalizeBackupCode(code));
    const index = hashes.indexOf(hash);
    if (index === -1) return null;
    return hashes.filter((_, i) => i !== index);
}

/** Short-lived ticket proving MFA was just completed; consumed by the NextAuth jwt callback. */
export function generateMfaTicket() {
    const ticket = randomBytes(32).toString("base64url");
    return { ticket, hash: sha256(ticket), expiry: new Date(Date.now() + 2 * 60 * 1000) };
}
