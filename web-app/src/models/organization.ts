import mongoose, { Schema } from "mongoose";

const organizationSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 64 },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
        /**
         * Members must have a passkey or authenticator app (and use it) to open anything in the org.
         * Deliberately no default: organizations created before this setting existed have no value and
         * count as requiring it (see requires2fa); new organizations are created with false.
         */
        require2fa: { type: Boolean },
    },
    { timestamps: true }
);

const Organization = mongoose.models.Organization || mongoose.model("Organization", organizationSchema);
export default Organization;
