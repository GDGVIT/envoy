/**
 * Pastel tones with meaning. Class strings are spelled out in full so Tailwind can see them.
 *   environments: development = mint, staging = lemon, production = rose, others by name
 *   roles: owner = mint (brand), admin = sky, member = neutral, editor = mint, viewer = peach
 */
export type Tone = "lavender" | "mint" | "sky" | "peach" | "rose" | "lemon" | "neutral";

export const TONE_BADGE: Record<Tone, string> = {
    lavender: "bg-pastel-lavender text-pastel-lavender-fg",
    mint: "bg-pastel-mint text-pastel-mint-fg",
    sky: "bg-pastel-sky text-pastel-sky-fg",
    peach: "bg-pastel-peach text-pastel-peach-fg",
    rose: "bg-pastel-rose text-pastel-rose-fg",
    lemon: "bg-pastel-lemon text-pastel-lemon-fg",
    neutral: "bg-muted text-muted-foreground",
};

export const TONE_DOT: Record<Tone, string> = {
    lavender: "bg-pastel-lavender-solid",
    mint: "bg-pastel-mint-solid",
    sky: "bg-pastel-sky-solid",
    peach: "bg-pastel-peach-solid",
    rose: "bg-pastel-rose-solid",
    lemon: "bg-pastel-lemon-solid",
    neutral: "bg-muted-foreground/50",
};

const CYCLE: Tone[] = ["lavender", "mint", "sky", "peach", "rose", "lemon"];

/** Stable tone for any name (teams, orgs, people). */
export function hashTone(name: string): Tone {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return CYCLE[Math.abs(h) % CYCLE.length];
}

export function envTone(slug: string): Tone {
    if (slug === "development" || slug.startsWith("dev")) return "mint";
    if (slug === "staging" || slug.startsWith("stag") || slug.startsWith("preview")) return "lemon";
    if (slug === "production" || slug.startsWith("prod")) return "rose";
    return hashTone(slug);
}

export function roleTone(role: string): Tone {
    switch (role) {
        case "owner":
            return "mint";
        case "admin":
            return "sky";
        case "editor":
            return "mint";
        case "viewer":
            return "peach";
        default:
            return "neutral";
    }
}
