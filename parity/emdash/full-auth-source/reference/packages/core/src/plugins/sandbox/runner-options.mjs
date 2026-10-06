import { createSiteInfo } from "../context.js";
/**
 * Build platform sandbox options with the same normalized site context used
 * by trusted plugin hooks and routes.
 */
export function createSandboxRunnerOptions(options, siteInfo) {
    return {
        ...options,
        siteInfo: createSiteInfo(siteInfo ?? {}),
    };
}
