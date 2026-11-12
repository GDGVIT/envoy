import { NextRequest } from "next/server";
import { Types, trusted } from "mongoose";
import { badRequest } from "@/lib/http";

/**
 * Keyset (cursor) pagination shared by every list endpoint.
 *
 * Request:  ?limit=50&cursor=<opaque>      limit defaults to 50, capped at 100.
 * Response: { <items>: [...], nextCursor: string | null }   null means this was the last page.
 *
 * The cursor holds the sort values of the last row on the page, so pages stay stable while rows
 * are added or removed (unlike skip/offset). It is opaque to clients: base64url-encoded JSON.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export type SortField = { key: string; dir: 1 | -1; type: "id" | "string" | "number" | "date" };

export type PageRequest = { limit: number; after: unknown[] | null };

export function readPage(req: NextRequest, fields: SortField[], defaultLimit = DEFAULT_LIMIT): PageRequest {
    const sp = req.nextUrl.searchParams;

    const rawLimit = sp.get("limit");
    let limit = defaultLimit;
    if (rawLimit !== null) {
        const n = Number(rawLimit);
        if (!Number.isInteger(n) || n < 1) throw badRequest("limit must be a positive whole number.", "invalid_limit");
        limit = Math.min(n, MAX_LIMIT);
    }

    const cursor = sp.get("cursor");
    if (!cursor) return { limit, after: null };
    return { limit, after: decodeCursor(cursor, fields) };
}

function decodeCursor(cursor: string, fields: SortField[]): unknown[] {
    let values: unknown;
    try {
        values = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch {
        throw badRequest("cursor is not valid. Use the nextCursor value from the previous page.", "invalid_cursor");
    }
    if (!Array.isArray(values) || values.length !== fields.length) {
        throw badRequest("cursor is not valid. Use the nextCursor value from the previous page.", "invalid_cursor");
    }
    return values.map((v, i) => {
        const f = fields[i];
        const bad = () => badRequest("cursor is not valid. Use the nextCursor value from the previous page.", "invalid_cursor");
        switch (f.type) {
            case "id":
                if (typeof v !== "string" || !Types.ObjectId.isValid(v)) throw bad();
                return new Types.ObjectId(v);
            case "date": {
                const d = new Date(String(v));
                if (typeof v !== "string" || Number.isNaN(d.getTime())) throw bad();
                return d;
            }
            case "number":
                if (typeof v !== "number" || !Number.isFinite(v)) throw bad();
                return v;
            default:
                if (typeof v !== "string") throw bad();
                return v;
        }
    });
}

function encodeCursor(values: unknown[]): string {
    const plain = values.map((v) => (v instanceof Date ? v.toISOString() : v instanceof Types.ObjectId ? String(v) : v));
    return Buffer.from(JSON.stringify(plain), "utf8").toString("base64url");
}

/**
 * Filter selecting rows strictly after the cursor in the given sort order:
 * (a > a0) OR (a = a0 AND b > b0) OR ... — with ">" flipped to "<" for descending fields.
 * Comparison operators are wrapped in trusted() so mongoose's sanitizeFilter keeps them.
 */
export function afterFilter(fields: SortField[], after: unknown[] | null): Record<string, unknown> {
    if (!after) return {};
    const or = fields.map((f, i) => {
        const clause: Record<string, unknown> = {};
        for (let j = 0; j < i; j++) clause[fields[j].key] = after[j];
        clause[f.key] = trusted({ [f.dir === 1 ? "$gt" : "$lt"]: after[i] });
        return clause;
    });
    return { $or: or };
}

/** Same as afterFilter, for an aggregation $match stage (no sanitizeFilter there). */
export function afterMatch(fields: SortField[], after: unknown[] | null): Record<string, unknown> {
    if (!after) return {};
    return {
        $or: fields.map((f, i) => {
            const clause: Record<string, unknown> = {};
            for (let j = 0; j < i; j++) clause[fields[j].key] = after[j];
            clause[f.key] = { [f.dir === 1 ? "$gt" : "$lt"]: after[i] };
            return clause;
        }),
    };
}

export function sortSpec(fields: SortField[]): Record<string, 1 | -1> {
    return Object.fromEntries(fields.map((f) => [f.key, f.dir]));
}

/**
 * Takes rows fetched with limit + 1 and returns the page plus the cursor for the next one.
 * `valuesOf` reads a row's sort values in the same order as the SortField list.
 */
export function toPage<T>(rows: T[], limit: number, valuesOf: (row: T) => unknown[]): { items: T[]; nextCursor: string | null } {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? encodeCursor(valuesOf(items[items.length - 1])) : null };
}
