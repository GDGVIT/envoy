"use client";

import { createContext, useContext } from "react";
import type { KeyedMutator } from "swr";

export type OrgRole = "owner" | "admin" | "member";
export type Access = "manage" | "edit" | "view";

export type NavProject = {
    id: string;
    name: string;
    slug: string;
    updatedAt: string;
    /** Set to "Only selected people": team members need to be on its allowlist. */
    restricted?: boolean;
};
export type NavTeam = {
    id: string;
    name: string;
    slug: string;
    description: string;
    myRole: "editor" | "viewer" | null;
    access: Access;
    memberCount: number;
    projects: NavProject[];
};
export type OrgSummary = { id: string; name: string; slug: string; role: OrgRole; memberCount: number; createdAt: string };
export type OrgData = { org: OrgSummary; teams: NavTeam[] };

export type OrgContextValue = {
    slug: string | null;
    data: OrgData | undefined;
    error: unknown;
    mutate: KeyedMutator<OrgData>;
    isAdmin: boolean;
    isOwner: boolean;
};

export const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg() {
    const ctx = useContext(OrgContext);
    if (!ctx) throw new Error("useOrg must be used inside the app shell");
    return ctx;
}

export const ROLE_LABEL: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    editor: "Editor",
    viewer: "Viewer",
};
