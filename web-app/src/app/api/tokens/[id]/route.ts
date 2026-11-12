import { NextRequest } from "next/server";
import ApiToken from "@/models/apiToken";
import { requireUser } from "@/lib/auth";
import { json, notFound, route } from "@/lib/http";

export const DELETE = route<{ id: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const result = await ApiToken.updateOne({ _id: params.id, user: me.id, revokedAt: null }, { revokedAt: new Date() });
    if (!result.matchedCount) throw notFound("Token not found.");
    return json({ message: "Token revoked." });
});
