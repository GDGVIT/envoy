import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        team: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 64 },
        slug: { type: String, required: true, lowercase: true, trim: true },
        description: { type: String, trim: true, maxlength: 280 },
        /** "Only selected people": team members see the project only if they're in `allowedUsers`. Org owners and admins always do. */
        restricted: { type: Boolean, default: false },
        allowedUsers: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    },
    { timestamps: true }
);

projectSchema.index({ team: 1, slug: 1 }, { unique: true });

const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);
export default Project;
