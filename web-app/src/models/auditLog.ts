import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
        actor: { type: Schema.Types.ObjectId, ref: "User" },
        actorName: { type: String },
        actorEmail: { type: String },
        action: { type: String, required: true },
        target: {
            type: { type: String },
            id: { type: String },
            name: { type: String },
        },
        meta: { type: Schema.Types.Mixed },
        ip: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ org: 1, createdAt: -1 });
auditLogSchema.index({ org: 1, action: 1, createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
