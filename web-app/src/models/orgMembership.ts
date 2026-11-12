import mongoose, { Schema } from "mongoose";

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

const orgMembershipSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: { type: String, enum: ORG_ROLES, required: true, default: "member" },
    },
    { timestamps: true }
);

orgMembershipSchema.index({ org: 1, user: 1 }, { unique: true });

const OrgMembership = mongoose.models.OrgMembership || mongoose.model("OrgMembership", orgMembershipSchema);
export default OrgMembership;
