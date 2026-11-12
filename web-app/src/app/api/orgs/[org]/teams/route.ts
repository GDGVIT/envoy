import { NextRequest } from "next/server";
import { z } from "zod";
import Team from "@/models/team";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOrgAdmin, loadOrg } from "@/lib/authz";
import { json, parseBody, route } from "@/lib/http";
import { nameSchema, uniqueSlug } from "@/lib/validation";

const schema = z.object({ name: nameSchema, description: z.string().trim().max(280).optional() });

export const POST = route<{ org: string }>(async (req: NextRequest, { params }) => {
    const me = await requireUser(req);
    const { org, role } = await loadOrg(params.org, me);
    assertOrgAdmin(role);
    const { name, description } = await parseBody(req, schema);

    const slug = await uniqueSlug(name, (s) => Team.exists({ org: org._id, slug: s }));
    const team = await Team.create({ org: org._id, name, slug, description });
    await audit(org, me, "team.create", { type: "team", id: String(team._id), name }, undefined, req);

    return json({ team: { id: team._id, name: team.name, slug: team.slug } }, 201);
});
