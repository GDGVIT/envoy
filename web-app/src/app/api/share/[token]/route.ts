import { NextRequest } from "next/server";
import BasicGroup from "@/models/basicGroup";
import { json, notFound, rateLimit, route } from "@/lib/http";
import { decrypt } from "@/utils/encryption";
import { MAX_SHARE_TTL_SECONDS, tokenExpiry } from "@/lib/share";

/** 410 with the expiry time, so the page can say when the link expired. */
const expired = (expiredAt: Date) =>
    json({ message: "This link has expired and its variables were deleted.", code: "expired", expiredAt }, 410);

export const GET = route<{ token: string }>(async (req: NextRequest, { params }) => {
    await rateLimit(req);
    const share: any = await BasicGroup.findOne({ token: params.token });
    if (!share) {
        // Already deleted (by the TTL index or an earlier visit): the token itself says whether it expired.
        const expiry = tokenExpiry(params.token);
        if (expiry && expiry.getTime() <= Date.now()) return expired(expiry);
        throw notFound("This link doesn't exist. Check that it was copied in full.");
    }

    // Expire on the stored date, and never later than 24 hours after creation, which also
    // retires older links that were created with longer lifetimes. The TTL index can lag,
    // so expired links are deleted here as soon as someone tries to open them.
    const created = share.createdAt?.getTime?.() ?? share.expireAt.getTime();
    const hardLimit = created + MAX_SHARE_TTL_SECONDS * 1000;
    const expiresAt = Math.min(share.expireAt.getTime(), hardLimit);
    if (expiresAt <= Date.now()) {
        await BasicGroup.deleteOne({ _id: share._id });
        return expired(new Date(expiresAt));
    }

    return json({
        expiresAt: new Date(expiresAt),
        vars: (share.envs ?? []).map((e: any) => ({ key: e.key, value: decrypt(e.value) })),
    });
});
