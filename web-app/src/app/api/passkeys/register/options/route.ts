import { NextRequest } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { requirePartialUser } from "@/lib/auth";
import { badRequest, json, route } from "@/lib/http";
import { assertCanEnroll, passkeysFor, relyingParty, saveChallenge, transportsOf } from "@/lib/passkeys";

const MAX_PASSKEYS = 10;

/** Step 1 of adding a passkey: options for the browser's "create a passkey" prompt. */
export const POST = route(async (req: NextRequest) => {
    const { user, jwt } = await requirePartialUser(req);
    assertCanEnroll(user, jwt);

    const existing = await passkeysFor(user._id);
    if (existing.length >= MAX_PASSKEYS) throw badRequest(`You can have up to ${MAX_PASSKEYS} passkeys. Remove one first.`);

    const { rpID, rpName } = relyingParty(req);
    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: user.email,
        userDisplayName: user.name,
        userID: isoUint8Array.fromUTF8String(String(user._id)),
        attestationType: "none",
        // Don't let the same authenticator register twice.
        excludeCredentials: existing.map((p: any) => ({ id: p.credentialId, transports: transportsOf(p) })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    await saveChallenge(user._id, options.challenge);
    return json(options);
});
