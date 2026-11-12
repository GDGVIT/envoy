"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { api } from "@/lib/api-client";

export type PasskeyPurpose = "login" | "reveal" | "backup-codes";

/** Whether this browser can create and use passkeys at all. */
export function passkeysSupported() {
    return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/** Creates a passkey with the browser's prompt and registers it with the server. */
export async function createPasskey(name?: string) {
    const optionsJSON = await api("/api/passkeys/register/options", { method: "POST" });
    const response = await startRegistration({ optionsJSON });
    return api<{ passkey: { id: string; name: string }; backupCodes: string[] | null; mfaTicket: string | null }>(
        "/api/passkeys/register/verify",
        { body: { response, name } }
    );
}

/** Asks for one of the user's passkeys and has the server confirm it for `purpose`. */
export async function confirmWithPasskey<T>(purpose: PasskeyPurpose) {
    const optionsJSON = await api("/api/passkeys/auth/options", { method: "POST" });
    const response = await startAuthentication({ optionsJSON });
    return api<T>("/api/passkeys/auth/verify", { body: { response, purpose } });
}

/**
 * A message for a failed passkey prompt, or null when the person simply closed it (nothing to report).
 */
export function passkeyError(e: unknown): string | null {
    const name = (e as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "AbortError") return null;
    if (name === "InvalidStateError") return "This device already has a passkey for your account.";
    if (name === "SecurityError") return "Passkeys aren't available on this address. Open Envoy from its usual URL.";
    return (e as Error)?.message || "Something went wrong with the passkey.";
}
