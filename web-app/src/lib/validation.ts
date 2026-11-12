import { z } from "zod";
import { slugify } from "@/lib/slug";

export { slugify };

export const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export const nameSchema = z.string().trim().min(1, "Name is required.").max(64, "Name is too long.");
export const slugSchema = z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, "Use lowercase letters, numbers and dashes (max 48 characters).");
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
export const passwordSchema = z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .max(128, "Password is too long.");
export const totpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const envVarSchema = z.object({
    key: z
        .string()
        .trim()
        .min(1, "Key is required.")
        .max(256, "Key is too long.")
        .regex(ENV_KEY_REGEX, "Keys must start with a letter or underscore and contain only letters, digits, _ . -"),
    value: z.string().max(32 * 1024, "Value is too long (32KB max)."),
});

/** A row as sent by the editor: `value` may be omitted to keep the stored one (from `from`, or the same key). */
export const envVarSaveSchema = z
    .array(
        envVarSchema.extend({
            value: envVarSchema.shape.value.optional(),
            from: envVarSchema.shape.key.optional(),
        })
    )
    .max(1000, "Too many variables (1000 max).")
    .superRefine((vars, ctx) => {
        const seen = new Set<string>();
        vars.forEach((v, i) => {
            if (seen.has(v.key)) ctx.addIssue({ code: "custom", message: `Duplicate key "${v.key}".`, path: [i, "key"] });
            seen.add(v.key);
        });
    });

export const envVarsSchema = z
    .array(envVarSchema)
    .max(1000, "Too many variables (1000 max).")
    .superRefine((vars, ctx) => {
        const seen = new Set<string>();
        vars.forEach((v, i) => {
            if (seen.has(v.key)) {
                ctx.addIssue({ code: "custom", message: `Duplicate key "${v.key}".`, path: [i, "key"] });
            }
            seen.add(v.key);
        });
    });

export const orgRoleSchema = z.enum(["admin", "member"]);
export const teamRoleSchema = z.enum(["editor", "viewer"]);

/** Returns `base`, or `base-2`, `base-3`… whichever is free according to `exists`. */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<unknown>) {
    const root = slugify(base);
    if (!(await exists(root))) return root;
    for (let i = 2; i < 100; i++) {
        const candidate = `${root}-${i}`;
        if (!(await exists(candidate))) return candidate;
    }
    return `${root}-${Math.random().toString(36).slice(2, 8)}`;
}
