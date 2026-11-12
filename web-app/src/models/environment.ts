import mongoose, { Schema } from "mongoose";

export const DEFAULT_ENVIRONMENTS = [
    { name: "Development", slug: "development" },
    { name: "Staging", slug: "staging" },
    { name: "Production", slug: "production" },
];

const environmentSchema = new Schema(
    {
        project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 32 },
        slug: { type: String, required: true, lowercase: true, trim: true },
        position: { type: Number, default: 0 },
        vars: [
            {
                _id: false,
                key: { type: String, required: true, trim: true },
                value: { type: String, default: "" }, // encrypted
            },
        ],
        version: { type: Number, default: 0 },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

environmentSchema.index({ project: 1, slug: 1 }, { unique: true });

const Environment = mongoose.models.Environment || mongoose.model("Environment", environmentSchema);
export default Environment;
