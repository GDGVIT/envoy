"use client";

import { signOut } from "next-auth/react";

export class ApiError extends Error {
    status: number;
    code?: string;
    /** The full error body, for errors that carry extra fields (e.g. `expiredAt`). */
    data?: any;
    constructor(status: number, message: string, code?: string, data?: any) {
        super(message);
        this.status = status;
        this.code = code;
        this.data = data;
    }
}

/** fetch wrapper for our JSON API: throws ApiError with the server's message. */
export async function api<T = any>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(url, {
        method: init.method ?? (init.body ? "POST" : "GET"),
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
        body: init.body ? JSON.stringify(init.body) : undefined,
    });

    let data: any = null;
    try {
        data = await res.json();
    } catch {
        /* empty body */
    }

    if (!res.ok) {
        if (res.status === 401 && (data?.code === "session_revoked" || data?.code === "mfa_required")) {
            await signOut({ callbackUrl: "/login?error=SessionRevoked" });
        }
        throw new ApiError(res.status, data?.message || `Request failed (${res.status}).`, data?.code, data);
    }
    return data as T;
}

export const fetcher = (url: string) => api(url);
