"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/api-client";

type PageShape<K extends string, T> = { [P in K]: T[] } & { nextCursor: string | null; total?: number };

/**
 * Reads a paginated list endpoint ({ <key>: T[], nextCursor, total? }) page by page.
 * `url` is the endpoint without limit/cursor (null to pause); `key` is the array field in the response.
 */
export function usePaginated<T, K extends string = string>(url: string | null, key: K, limit = 50) {
    const sep = url?.includes("?") ? "&" : "?";
    const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<PageShape<K, T>>(
        (index, previous) => {
            if (!url) return null;
            if (index === 0) return `${url}${sep}limit=${limit}`;
            if (!previous?.nextCursor) return null; // reached the end
            return `${url}${sep}limit=${limit}&cursor=${encodeURIComponent(previous.nextCursor)}`;
        },
        fetcher,
        { revalidateFirstPage: true }
    );

    const items: T[] = data ? data.flatMap((p) => p[key] ?? []) : [];
    const last = data?.[data.length - 1];
    const hasMore = !!last?.nextCursor;
    const loadingMore = isValidating && !!data && size > data.length;

    return {
        items,
        /** Total across all pages, when the endpoint reports it. */
        total: data?.[0]?.total,
        error,
        isLoading,
        hasMore,
        loadingMore,
        loadMore: () => setSize((s) => s + 1),
        /** Refetch every loaded page (after a create, update or delete). */
        mutate,
        /** First page's raw response, for endpoints that return extra fields alongside the list. */
        first: data?.[0],
    };
}
