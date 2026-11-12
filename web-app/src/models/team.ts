import mongoose, { Schema } from "mongoose";

const teamSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 64 },
        slug: { type: String, required: true, lowercase: true, trim: true },
        description: { type: String, trim: true, maxlength: 280 },
    },
    { timestamps: true }
);

teamSchema.index({ org: 1, slug: 1 }, { unique: true });

const Team = mongoose.models.Team || mongoose.model("Team", teamSchema);
export default Team;
