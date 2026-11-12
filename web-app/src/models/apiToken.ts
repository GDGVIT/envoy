import mongoose, { Schema } from "mongoose";

const apiTokenSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 64 },
        prefix: { type: String, required: true },
        tokenHash: { type: String, required: true, unique: true, index: true },
        expiresAt: { type: Date },
        lastUsedAt: { type: Date },
        revokedAt: { type: Date },
    },
    { timestamps: true }
);

const ApiToken = mongoose.models.ApiToken || mongoose.model("ApiToken", apiTokenSchema);
export default ApiToken;
