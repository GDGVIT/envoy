import { NextRequest } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { requirePartialUser } from "@/lib/auth";
import { badRequest, json, route } from "@/lib/http";
import { passkeysFor, relyingParty, saveChallenge, transportsOf } from "@/lib/passkeys";

/** Options for the browser's "use your passkey" prompt (sign-in second step, unlocking values…). */
export const POST = route(async (req: NextRequest) => {
    const { user } = await requirePartialUser(req);
    const keys = await passkeysFor(user._id);
    if (!keys.length) throw badRequest("There are no passkeys on this account.", "no_passkeys");

    const { rpID } = relyingParty(req);
    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: keys.map((p: any) => ({ id: p.credentialId, transports: transportsOf(p) })),
        userVerification: "preferred",
    });
    await saveChallenge(user._id, options.challenge);
    return json(options);
});
