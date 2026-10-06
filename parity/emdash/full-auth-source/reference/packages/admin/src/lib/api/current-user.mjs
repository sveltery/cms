/**
 * Current user query — shared across Shell, Header, Sidebar, and CommandPalette.
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, parseApiResponse } from "./client.js";
async function fetchCurrentUser() {
    const response = await apiFetch("/_emdash/api/auth/me");
    return parseApiResponse(response, i18n._(msg `Failed to fetch user`));
}
export function useCurrentUser() {
    return useQuery({
        queryKey: ["currentUser"],
        queryFn: fetchCurrentUser,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
}
