/**
 * Plugin Routes v2
 *
 * Handles plugin API route invocation with:
 * - Input validation via Zod schemas
 * - Route context creation
 * - Error handling
 *
 */
import { routeNameSchema } from "@emdash-cms/plugin-types";
import { z } from "zod";
import { SiteWriteBlockedError } from "../transfer/fence.js";
import { PluginContextFactory } from "./context.js";
import { extractRequestMeta } from "./request-meta.js";
import { PluginRouteError } from "./route-error.js";
import { parseDeclaredPluginRouteInput } from "./route-wire.js";
export { PluginRouteError };
/**
 * Body-reading methods on `Request`. EmDash parses the request body once before
 * the handler runs and exposes the result as `ctx.input`, leaving the underlying
 * stream consumed. Calling any of these on `ctx.request` would re-read a spent
 * stream and throw an opaque platform error ("Body is unusable: Body has already
 * been read") with no hint about `ctx.input` — so the guard replaces them with an
 * actionable message instead.
 */
const CONSUMED_BODY_METHODS = new Set(["json", "text", "arrayBuffer", "blob", "formData", "bytes"]);
/**
 * Wrap the request handed to a plugin route handler so an accidental
 * `ctx.request.json()` (or `.text()`, `.formData()`, …) fails with a message
 * pointing at `ctx.input` rather than the runtime's cryptic "body already read"
 * error. Every non-body member passes through unchanged; function members are
 * bound to the underlying request so methods like `clone()` don't throw an
 * "Illegal invocation" when called on the proxy.
 */
function guardConsumedRequestBody(request) {
    return new Proxy(request, {
        get(target, prop) {
            if (typeof prop === "string" && CONSUMED_BODY_METHODS.has(prop)) {
                return () => {
                    throw new Error(`[emdash] ctx.request.${prop}() is not available inside a plugin route handler: ` +
                        `EmDash has already parsed the request body and exposes it as ctx.input. ` +
                        `Read ctx.input instead of ctx.request.${prop}().`);
                };
            }
            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}
export const pluginPublicRouteAcknowledgementSchema = z.array(routeNameSchema);
/**
 * Build RouteMeta from a route's `public`/`cacheControl` flags. Single source
 * of truth for the "cacheControl is only ever exposed on public routes"
 * invariant — used for trusted routes and manifest-declared sandboxed routes.
 */
export function buildRouteMeta(route) {
    const meta = { public: route.public === true };
    if (route.permission !== undefined)
        meta.permission = route.permission;
    if (route.methods !== undefined)
        meta.methods = [...route.methods];
    if (route.request !== undefined) {
        meta.request = {
            ...route.request,
            ...(route.request.headers ? { headers: [...route.request.headers] } : {}),
        };
    }
    if (route.response !== undefined)
        meta.response = route.response;
    // Private responses are per-user and must never become cacheable, even if
    // a route sets both flags.
    if (meta.public && typeof route.cacheControl === "string" && route.cacheControl.length > 0) {
        meta.cacheControl = route.cacheControl;
    }
    return meta;
}
/**
 * HTTP methods that carry a request body. Everything else (GET, HEAD, DELETE)
 * takes its route input from the URL query string.
 */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
/**
 * Parse a plugin route's input from the request, by method.
 *
 * Body methods (POST/PUT/PATCH) parse the JSON body as before. Bodyless
 * methods (GET/HEAD/DELETE) have no body, so `request.json()` resolves to
 * undefined and fails schema validation, so parse the query string into
 * an object instead. Repeated keys (`?tag=a&tag=b`) become an array so array
 * schemas work; a single key stays a scalar.
 */
export async function parseRouteInput(request, declaration) {
    if (declaration)
        return parseDeclaredPluginRouteInput(request, declaration);
    if (BODY_METHODS.has(request.method.toUpperCase())) {
        try {
            return await request.json();
        }
        catch {
            // No body or not JSON
            return undefined;
        }
    }
    const params = new URL(request.url).searchParams;
    const input = {};
    for (const key of new Set(params.keys())) {
        const values = params.getAll(key);
        input[key] = values.length > 1 ? values : values[0];
    }
    return input;
}
/**
 * Convert the host's authenticated user into the read-only `UserInfo` shape
 * exposed to plugins as `ctx.user`. Strips sensitive/irrelevant fields and
 * keeps the value structured-clone-safe for sandboxed plugins.
 */
export function toRouteCallerInfo(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: typeof user.createdAt === "string" ? user.createdAt : user.createdAt.toISOString(),
    };
}
/**
 * Route handler for a plugin
 */
export class PluginRouteHandler {
    contextFactory;
    plugin;
    trustedProxyHeaders;
    constructor(plugin, factoryOptions) {
        this.plugin = plugin;
        this.contextFactory = new PluginContextFactory(factoryOptions);
        this.trustedProxyHeaders = factoryOptions.trustedProxyHeaders ?? [];
    }
    /**
     * Invoke a route by name
     */
    async invoke(routeName, options) {
        const route = this.plugin.routes[routeName];
        if (!route) {
            return {
                success: false,
                error: {
                    code: "ROUTE_NOT_FOUND",
                    message: `Route "${routeName}" not found in plugin "${this.plugin.id}"`,
                },
                status: 404,
            };
        }
        // Validate input if schema is provided
        let validatedInput;
        if (route.input) {
            const parseResult = route.input.safeParse(options.body);
            if (!parseResult.success) {
                return {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid request body",
                        details: z.formatError(parseResult.error),
                    },
                    status: 400,
                };
            }
            validatedInput = parseResult.data;
        }
        else {
            validatedInput = options.body;
        }
        // Create route context
        const baseContext = this.contextFactory.createContext(this.plugin);
        const routeContext = {
            ...baseContext,
            input: validatedInput,
            // The body is already parsed into `input`; guard `ctx.request`'s
            // body-reading methods so a re-read fails with an actionable message.
            // Metadata extraction uses the original request (headers only).
            request: guardConsumedRequestBody(options.request),
            requestMeta: extractRequestMeta(options.request, this.trustedProxyHeaders),
            user: options.user,
            ui: options.ui,
        };
        // Execute handler
        try {
            const result = await route.handler(routeContext);
            return {
                success: true,
                data: result,
                status: 200,
            };
        }
        catch (error) {
            if (error instanceof SiteWriteBlockedError) {
                return {
                    success: false,
                    error: { code: error.code, message: error.message },
                    status: error.status,
                };
            }
            // Handle known error types
            if (error instanceof PluginRouteError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                    },
                    status: error.status,
                };
            }
            // Unknown error -- log internally, return generic message
            console.error(`[plugin:${this.plugin.id}] Route handler failed:`, error);
            return {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An internal error occurred",
                },
                status: 500,
            };
        }
    }
    /**
     * Get all route names
     */
    getRouteNames() {
        return Object.keys(this.plugin.routes);
    }
    /**
     * Check if a route exists
     */
    hasRoute(name) {
        return name in this.plugin.routes;
    }
    /**
     * Get route metadata without invoking the handler.
     * Returns null if the route doesn't exist.
     */
    getRouteMeta(name) {
        const route = this.plugin.routes[name];
        if (!route)
            return null;
        return buildRouteMeta(route);
    }
}
/**
 * Registry for all plugin route handlers
 */
export class PluginRouteRegistry {
    factoryOptions;
    handlers = new Map();
    constructor(factoryOptions) {
        this.factoryOptions = factoryOptions;
    }
    /**
     * Register a plugin's routes
     */
    register(plugin) {
        const handler = new PluginRouteHandler(plugin, this.factoryOptions);
        this.handlers.set(plugin.id, handler);
    }
    /**
     * Unregister a plugin's routes
     */
    unregister(pluginId) {
        this.handlers.delete(pluginId);
    }
    /**
     * Invoke a plugin route
     */
    async invoke(pluginId, routeName, options) {
        const handler = this.handlers.get(pluginId);
        if (!handler) {
            return {
                success: false,
                error: {
                    code: "PLUGIN_NOT_FOUND",
                    message: `Plugin "${pluginId}" not found`,
                },
                status: 404,
            };
        }
        return handler.invoke(routeName, options);
    }
    /**
     * Get all registered plugin IDs
     */
    getPluginIds() {
        return [...this.handlers.keys()];
    }
    /**
     * Get routes for a plugin
     */
    getRoutes(pluginId) {
        return this.handlers.get(pluginId)?.getRouteNames() ?? [];
    }
    /**
     * Get route metadata for a specific plugin route.
     * Returns null if the plugin or route doesn't exist.
     */
    getRouteMeta(pluginId, routeName) {
        const handler = this.handlers.get(pluginId);
        if (!handler)
            return null;
        return handler.getRouteMeta(routeName);
    }
}
/**
 * Create a route registry
 */
export function createRouteRegistry(factoryOptions) {
    return new PluginRouteRegistry(factoryOptions);
}
