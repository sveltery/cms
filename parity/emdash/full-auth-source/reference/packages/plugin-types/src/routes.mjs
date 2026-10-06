import { z } from "zod";
export const PLUGIN_ROUTE_MAX_BODY_BYTES = 8 * 1024 * 1024;
export const PLUGIN_ROUTE_DEFAULT_BODY_BYTES = 1024 * 1024;
export const PLUGIN_ROUTE_MAX_MULTIPART_PARTS = 100;
export const PLUGIN_ROUTE_MAX_MULTIPART_PART_BYTES = 1024 * 1024;
export const PLUGIN_ROUTE_MAX_FILENAME_BYTES = 255;
export const PLUGIN_ROUTE_MAX_DECLARED_HEADERS = 32;
export const PLUGIN_ROUTE_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
export const PLUGIN_ROUTE_BODY_MODES = ["none", "json", "text", "bytes", "form-data"];
export const PLUGIN_ROUTE_RESPONSE_MODES = ["json", "raw"];
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const FORBIDDEN_REQUEST_HEADERS = new Set([
    "authorization",
    "cookie",
    "cf-access-client-id",
    "cf-access-client-secret",
    "cf-access-jwt-assertion",
    "proxy-authorization",
    "set-cookie",
    "x-emdash-request",
]);
const declaredHeadersSchema = z
    .array(z.string().min(1).max(128).regex(HEADER_NAME_PATTERN, "Invalid HTTP header name"))
    .max(PLUGIN_ROUTE_MAX_DECLARED_HEADERS)
    .superRefine((headers, ctx) => {
    const seen = new Set();
    for (const [index, header] of headers.entries()) {
        const normalized = header.toLowerCase();
        if (FORBIDDEN_REQUEST_HEADERS.has(normalized) || normalized.startsWith("cf-access-")) {
            ctx.addIssue({
                code: "custom",
                message: `Header "${header}" cannot be exposed to a sandboxed route`,
                path: [index],
            });
        }
        if (seen.has(normalized)) {
            ctx.addIssue({
                code: "custom",
                message: `Header "${header}" is declared more than once`,
                path: [index],
            });
        }
        seen.add(normalized);
    }
});
export const pluginRouteRequestSchema = z
    .object({
    body: z.enum(PLUGIN_ROUTE_BODY_MODES),
    maxBytes: z.number().int().positive().max(PLUGIN_ROUTE_MAX_BODY_BYTES).optional(),
    headers: declaredHeadersSchema.optional(),
})
    .superRefine((request, ctx) => {
    if (request.body === "none" && request.maxBytes !== undefined) {
        ctx.addIssue({
            code: "custom",
            message: "maxBytes cannot be set when request.body is none",
            path: ["maxBytes"],
        });
    }
});
export const routeOptionsSchema = z
    .object({
    methods: z
        .array(z.enum(PLUGIN_ROUTE_METHODS))
        .min(1)
        .max(PLUGIN_ROUTE_METHODS.length)
        .optional(),
    request: pluginRouteRequestSchema.optional(),
    response: z.enum(PLUGIN_ROUTE_RESPONSE_MODES).optional(),
    public: z.boolean().optional(),
    permission: z.string().min(1).optional(),
    cacheControl: z.string().min(1).optional(),
})
    .superRefine((route, ctx) => {
    if (route.methods && new Set(route.methods).size !== route.methods.length) {
        ctx.addIssue({ code: "custom", message: "Route methods must not contain duplicates" });
    }
});
export const routeNameSchema = z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_\-/]*$/, "Route name must be a safe path segment");
export const manifestRouteEntrySchema = routeOptionsSchema.extend({ name: routeNameSchema });
export function extractRouteOptions(route) {
    return routeOptionsSchema.parse(typeof route === "function" ? {} : route);
}
export function extractManifestRoute(name, route) {
    const options = extractRouteOptions(route);
    if (Object.values(options).every((value) => value === undefined))
        return name;
    return { name, ...options };
}
export function normalizeManifestRoute(entry) {
    return typeof entry === "string" ? { name: entry } : entry;
}
export function isJsonPostRouteContract(route) {
    return (route.response !== "raw" &&
        (route.methods === undefined || route.methods.includes("POST")) &&
        (route.request === undefined || route.request.body === "json"));
}
