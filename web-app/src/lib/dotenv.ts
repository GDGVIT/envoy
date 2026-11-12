export type EnvVar = { key: string; value: string };

/** Parses .env text: supports comments, `export KEY=`, single/double quotes and \n escapes in double quotes. */
export function parseDotenv(text: string): EnvVar[] {
    const result = new Map<string, string>();
    const lines = text.replace(/\r\n?/g, "\n").split("\n");

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;
        if (line.startsWith("export ")) line = line.slice(7).trim();

        const eq = line.indexOf("=");
        if (eq <= 0) continue;

        const key = line.slice(0, eq).trim().replace(/^['"]|['"]$/g, "");
        let value = line.slice(eq + 1).trim();

        const quote = value[0];
        if (quote === '"' || quote === "'" || quote === "`") {
            // Multi-line quoted values: keep consuming lines until the closing quote.
            let body = value.slice(1);
            while (!body.endsWith(quote) && i + 1 < lines.length) {
                body += "\n" + lines[++i];
            }
            value = body.endsWith(quote) ? body.slice(0, -1) : body;
            if (quote === '"') {
                value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
            }
        } else {
            const hash = value.search(/\s#/);
            if (hash !== -1) value = value.slice(0, hash).trim();
        }

        if (key) result.set(key, value);
    }

    return Array.from(result, ([key, value]) => ({ key, value }));
}

function quote(value: string) {
    if (value === "" || /^[A-Za-z0-9_./:@,+-]+$/.test(value)) return value;
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
}

export function stringifyDotenv(vars: EnvVar[]) {
    return vars.map(({ key, value }) => `${key}=${quote(value)}`).join("\n") + (vars.length ? "\n" : "");
}
