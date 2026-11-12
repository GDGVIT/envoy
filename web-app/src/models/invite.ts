import mongoose, { Schema } from "mongoose";
import { ORG_ROLES } from "./orgMembership";
import { TEAM_ROLES } from "./teamMembership";

const inviteSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        kind: { type: String, enum: ["email", "link"], required: true },
        email: { type: String, lowercase: true, trim: true, index: true, sparse: true },
        tokenHash: { type: String, required: true, unique: true, index: true },
        orgRole: { type: String, enum: ORG_ROLES.filter((r) => r !== "owner"), default: "member" },
        team: { type: Schema.Types.ObjectId, ref: "Team" },
        teamRole: { type: String, enum: TEAM_ROLES },
        expiresAt: { type: Date, required: true },
        maxUses: { type: Number },
        uses: { type: Number, default: 0 },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        revokedAt: { type: Date },
        acceptedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    { timestamps: true }
);

const Invite = mongoose.models.Invite || mongoose.model("Invite", inviteSchema);
export default Invite;
