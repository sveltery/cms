import { resolveAndValidateExternalUrlTarget, SsrfError } from "../security/ssrf.js";
const TRAILING_DOT = /\.+$/;
const LOCALHOST_HOSTNAMES = new Set([
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
]);
let defaultTransport = null;
export function setDefaultRegistryArtifactTransport(transport) {
    const previous = defaultTransport;
    defaultTransport = transport;
    return previous;
}
function isLocalhostHostname(hostname) {
    const normalized = hostname.toLowerCase().replace(TRAILING_DOT, "");
    return (LOCALHOST_HOSTNAMES.has(normalized) ||
        normalized.endsWith(".localhost") ||
        normalized === "127.0.0.1" ||
        normalized === "::1" ||
        normalized === "[::1]" ||
        normalized.startsWith("::ffff:127.") ||
        normalized.startsWith("::ffff:7f00:"));
}
async function resolveSafeArtifactTarget(urlString) {
    let url;
    try {
        url = new URL(urlString);
    }
    catch {
        throw new Error(`Invalid artifact URL: ${urlString}`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`Artifact URL protocol not allowed: ${url.protocol}`);
    }
    if (url.username || url.password) {
        throw new Error("Artifact URL must not contain embedded credentials");
    }
    const rawHostname = url.hostname.toLowerCase().replace(TRAILING_DOT, "");
    const hostname = stripIpv6Brackets(rawHostname);
    const localhost = isLocalhostHostname(hostname);
    if (!import.meta.env.DEV) {
        if (url.protocol === "http:") {
            throw new Error("Artifact URL must use https");
        }
        if (localhost) {
            throw new Error(`Artifact URL points to localhost: ${hostname}`);
        }
    }
    else if (url.protocol === "http:" && !localhost) {
        throw new Error("Artifact URL must use https (http allowed only for localhost in dev)");
    }
    if (localhost) {
        return { url, addresses: [] };
    }
    try {
        return await resolveAndValidateExternalUrlTarget(url.href);
    }
    catch (error) {
        if (error instanceof SsrfError) {
            throw new Error(`Artifact URL rejected: ${error.message}`, { cause: error });
        }
        throw error;
    }
}
export async function assertSafeArtifactUrl(urlString) {
    return (await resolveSafeArtifactTarget(urlString)).url;
}
export async function fetchRegistryArtifactUrl(urlString, options) {
    if (!Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes < 0) {
        throw new TypeError("Registry artifact response limit is invalid");
    }
    const target = await resolveSafeArtifactTarget(urlString);
    if (target.addresses.length === 0) {
        return globalThis.fetch(target.url, { redirect: "manual", signal: options.signal });
    }
    const transport = defaultTransport ?? (await createRuntimeRegistryArtifactTransport());
    const result = await transport.fetch({
        url: target.url,
        allowedAddresses: target.addresses,
        signal: options.signal,
        maxResponseBytes: options.maxResponseBytes,
    });
    if (result.connectedAddress !== null && !target.addresses.includes(result.connectedAddress)) {
        await result.response.body?.cancel().catch(() => undefined);
        throw new Error("Registry artifact transport connected outside the validated address set");
    }
    return result.response;
}
async function createRuntimeRegistryArtifactTransport() {
    return isCloudflareWorkersRuntime()
        ? createWorkersRegistryArtifactTransport()
        : createNodeRegistryArtifactTransport();
}
export function createWorkersRegistryArtifactTransport(workerFetch = globalThis.fetch) {
    return {
        async fetch(input) {
            const response = await workerFetch(input.url, {
                redirect: "manual",
                signal: input.signal,
                headers: { "Accept-Encoding": "identity" },
            });
            return {
                response: limitResponseBody(response, input.maxResponseBytes),
                connectedAddress: null,
            };
        },
    };
}
function isCloudflareWorkersRuntime() {
    return (typeof navigator !== "undefined" &&
        typeof navigator.userAgent === "string" &&
        navigator.userAgent.includes("Cloudflare-Workers"));
}
function limitResponseBody(response, maxBytes) {
    if (!response.body)
        return response;
    let received = 0;
    const body = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > maxBytes) {
                controller.error(new RangeError("Registry artifact response exceeds its byte limit"));
                return;
            }
            controller.enqueue(chunk);
        },
    }));
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}
export async function createNodeRegistryArtifactTransport(nodeRequest) {
    const request = nodeRequest ?? (await import("node:https")).request;
    return {
        async fetch(input) {
            let lastError;
            for (const address of input.allowedAddresses) {
                try {
                    const response = await new Promise((resolve, reject) => {
                        const chunks = [];
                        let total = 0;
                        const req = request({
                            protocol: "https:",
                            hostname: stripIpv6Brackets(input.url.hostname),
                            port: parseHttpsPort(input.url),
                            path: `${input.url.pathname}${input.url.search}`,
                            method: "GET",
                            // A pooled socket may have been opened for the same hostname
                            // before this address set was resolved.
                            agent: false,
                            headers: {
                                Host: input.url.host,
                                Connection: "close",
                                "Accept-Encoding": "identity",
                            },
                            lookup: (_hostname, options, callback) => {
                                const family = address.includes(":") ? 6 : 4;
                                // Node's default autoSelectFamily asks with `all: true` and expects a list.
                                if (options.all)
                                    callback(null, [{ address, family }]);
                                else
                                    callback(null, address, family);
                            },
                            signal: input.signal,
                        }, (upstream) => {
                            const contentEncoding = upstream.headers["content-encoding"];
                            if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
                                upstream.destroy(new Error("Registry artifact response content encoding is unsupported"));
                                return;
                            }
                            upstream.on("data", (chunk) => {
                                total += chunk.byteLength;
                                if (total > input.maxResponseBytes) {
                                    upstream.destroy(new RangeError("Registry artifact response exceeds its byte limit"));
                                    return;
                                }
                                chunks.push(new Uint8Array(chunk));
                            });
                            upstream.once("error", reject);
                            upstream.once("end", () => {
                                const bytes = concatBytes(chunks, total);
                                const headers = new Headers();
                                for (let index = 0; index < upstream.rawHeaders.length; index += 2) {
                                    headers.append(upstream.rawHeaders[index], upstream.rawHeaders[index + 1]);
                                }
                                resolve(parsedResponseToWebResponse({
                                    status: upstream.statusCode ?? 502,
                                    headers,
                                    body: bytes,
                                }));
                            });
                        });
                        req.once("error", reject);
                        req.end();
                    });
                    return { response, connectedAddress: address };
                }
                catch (error) {
                    if (input.signal.aborted)
                        throw error;
                    lastError = error;
                }
            }
            throw new Error("Registry artifact transport could not connect to an approved address", {
                cause: lastError,
            });
        },
    };
}
function parsedResponseToWebResponse(parsed) {
    const bodyAllowed = ![204, 205, 304].includes(parsed.status);
    let body = null;
    if (bodyAllowed) {
        body = new ArrayBuffer(parsed.body.byteLength);
        new Uint8Array(body).set(parsed.body);
    }
    return new Response(body, {
        status: parsed.status,
        headers: parsed.headers,
    });
}
function concatBytes(chunks, total) {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
function parseHttpsPort(url) {
    const port = url.port === "" ? 443 : Number(url.port);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
        throw new TypeError("Registry artifact HTTPS port is invalid");
    }
    return port;
}
function stripIpv6Brackets(hostname) {
    return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
