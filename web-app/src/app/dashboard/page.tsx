import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/(auth)/auth/[...nextauth]/options";
import connectMongo from "@/utils/connectMongo";
import User from "@/models/user";
import OrgMembership from "@/models/orgMembership";
import Organization from "@/models/organization";
import { trusted } from "mongoose";

/** Entry point after sign-in: go to the last-used org, else the first org, else onboarding. */
export default async function DashboardRedirect() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect("/login");

    await connectMongo();
    const user = await User.findById(session.user.id).select("lastOrgSlug");
    const memberships = await OrgMembership.find({ user: session.user.id }).select("org").sort({ createdAt: 1 });
    if (!memberships.length) redirect("/onboarding");

    const orgs = await Organization.find({ _id: trusted({ $in: memberships.map((m: any) => m.org) }) }).select("slug");
    const slugs = orgs.map((o: any) => o.slug);
    const target = user?.lastOrgSlug && slugs.includes(user.lastOrgSlug) ? user.lastOrgSlug : slugs[0];

    redirect(target ? `/o/${target}` : "/onboarding");
}
