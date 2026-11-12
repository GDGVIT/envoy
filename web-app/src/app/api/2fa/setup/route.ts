import { NextRequest } from "next/server";
import { requirePartialUser } from "@/lib/auth";
import { badRequest, json, route } from "@/lib/http";
import { generateTotpSecret, totpQrDataUrl, totpUri } from "@/lib/totp";
import { encrypt } from "@/utils/encryption";
import { assertCanEnroll } from "@/lib/passkeys";
import User from "@/models/user";

/** Starts enrollment: creates a pending secret and returns it as a QR code + manual key. */
export const POST = route(async (req: NextRequest) => {
    const { user, jwt } = await requirePartialUser(req);
    if (user.totpEnabled) throw badRequest("An authenticator app is already set up.");
    assertCanEnroll(user, jwt);

    const secret = generateTotpSecret();
    await User.updateOne({ _id: user._id }, { totpPendingSecret: encrypt(secret) });

    const uri = totpUri(secret, user.email);
    return json({ secret, uri, qr: await totpQrDataUrl(uri) });
});
