import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            index: true,
            match: /^[a-zA-Z0-9_]{3,30}$/,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Basic email regex
        },
        password: {
            type: String,
            required: true,
            select: false,
        },
        workspaces: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Workspace',
            },
        ],
    },
    {
        timestamps: true,
    }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;