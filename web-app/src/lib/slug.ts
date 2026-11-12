/** Lowercase, dash-separated URL slug (max 40 chars). Safe to use on the client. */
export function slugify(input: string) {
    const slug = input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['\u2019]/g, "") // "Chirayu's" -> "chirayus", not "chirayu-s"
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/g, "");
    return slug || "untitled";
}
