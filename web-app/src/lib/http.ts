import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";
import connectMongo from "@/utils/connectMongo";
import { generalLimiter, getUserIP } from "@/utils/limiter";

export class HttpError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const unauthorized = (message = "Unauthorized", code?: string) => new HttpError(401, message, code);
export const forbidden = (message = "You do not have permission to do that.", code?: string) =>
    new HttpError(403, message, code);
export const notFound = (message = "Not found.") => new HttpError(404, message);
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);

export function json(data: unknown, status = 200) {
    return NextResponse.json(data, { status });
}

export async function rateLimit(req: NextRequest, key?: string) {
    try {
        await generalLimiter.consume(key ?? getUserIP(req));
    } catch {
        throw new HttpError(429, "Too many requests. Please try again later.");
    }
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        throw badRequest("Request body must be valid JSON.");
    }
    return schema.parse(raw);
}

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response>;

/**
 * Wraps a route handler: connects to Mongo, resolves async params and maps
 * thrown errors (HttpError, ZodError, rate-limit, duplicate key) to JSON responses.
 */
export function route<P = Record<string, string>>(fn: Handler<P>) {
    return async (req: NextRequest, ctx: { params: Promise<P> }) => {
        try {
            await connectMongo();
            const params = (await ctx?.params) ?? ({} as P);
            return await fn(req, { params });
        } catch (error: any) {
            if (error instanceof HttpError) {
                return json({ message: error.message, code: error.code }, error.status);
            }
            if (error instanceof ZodError) {
                const issue = error.issues[0];
                const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
                return json({ message: `${path}${issue?.message ?? "Invalid input."}`, code: "invalid_input" }, 400);
            }
            if (error?.msBeforeNext !== undefined) {
                return json({ message: "Too many requests. Please try again later." }, 429);
            }
            if (error?.code === 11000) {
                return json({ message: "That name is already taken.", code: "duplicate" }, 409);
            }
            console.error(error);
            return json({ message: "Internal Server Error." }, 500);
        }
    };
}
