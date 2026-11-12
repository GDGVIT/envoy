import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { passkeysFor } from "@/lib/passkeys";

/** The signed-in user's passkeys (names and dates only). */
export const GET = route(async (req: NextRequest) => {
    const me = await requireUser(req);
    const keys = await passkeysFor(me.id);
    return json({
        passkeys: keys.map((p: any) => ({
            id: p._id,
            name: p.name,
            createdAt: p.createdAt,
            lastUsedAt: p.lastUsedAt ?? null,
            backedUp: !!p.backedUp,
        })),
    });
});
