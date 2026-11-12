import mongoose, { Schema } from "mongoose";

export const TEAM_ROLES = ["editor", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

const teamMembershipSchema = new Schema(
    {
        team: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: { type: String, enum: TEAM_ROLES, required: true, default: "viewer" },
    },
    { timestamps: true }
);

teamMembershipSchema.index({ team: 1, user: 1 }, { unique: true });

const TeamMembership = mongoose.models.TeamMembership || mongoose.model("TeamMembership", teamMembershipSchema);
export default TeamMembership;
