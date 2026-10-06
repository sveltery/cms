import { getPublicKeyFromDidController, P256PublicKey, Secp256k1PublicKey, } from "@atcute/crypto";
import { getAtprotoVerificationMaterial, getPdsEndpoint } from "@atcute/identity";
import { AtprotoWebDidDocumentResolver, CompositeDidDocumentResolver, PlcDidDocumentResolver, } from "@atcute/identity-resolver";
import { isDid } from "@atcute/lexicons/syntax";
import { safeParse } from "@atcute/lexicons/validations";
import { fromStream, verifyRecord } from "@atcute/repo";
import { NSID, PackageProfile, PackageRelease } from "@emdash-cms/registry-lexicons";
export const DEFAULT_DIRECT_PDS_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_DIRECT_PDS_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_TIMEOUT_MS = 2_147_483_647;
const DIGITS = /^[0-9]+$/;
const PACKAGE_SLUG = /^[a-z][a-z0-9_-]{0,63}$/;
export class DirectPdsReadError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.name = "DirectPdsReadError";
        this.code = code;
        this.status = status;
    }
}
export class DirectPdsClient {
    did;
    #fetch;
    #resolver;
    #resolvedPublisher;
    constructor(options) {
        if (!isAtprotoDid(options.did)) {
            throw new TypeError("did must be a valid did:plc or did:web identifier");
        }
        const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_DIRECT_PDS_REQUEST_TIMEOUT_MS;
        const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_DIRECT_PDS_MAX_RESPONSE_BYTES;
        validatePositiveSafeInteger(requestTimeoutMs, "requestTimeoutMs");
        if (requestTimeoutMs > MAX_TIMEOUT_MS) {
            throw new RangeError(`requestTimeoutMs must not exceed ${MAX_TIMEOUT_MS}`);
        }
        validatePositiveSafeInteger(maxResponseBytes, "maxResponseBytes");
        this.did = options.did;
        this.#fetch = createBoundedFetch(options.fetch, {
            requestTimeoutMs,
            maxResponseBytes,
            signal: options.signal,
        });
        this.#resolver =
            options.didDocumentResolver ??
                new CompositeDidDocumentResolver({
                    methods: {
                        plc: new PlcDidDocumentResolver({ fetch: this.#fetch }),
                        web: new AtprotoWebDidDocumentResolver({ fetch: this.#fetch }),
                    },
                });
    }
    async getPackageProfile(packageSlug) {
        validatePackageSlug(packageSlug);
        const record = await this.#getVerifiedRecord(NSID.packageProfile, packageSlug);
        const parsed = safeParse(PackageProfile.mainSchema, record.value);
        if (!parsed.ok) {
            throw new DirectPdsReadError("PROFILE_LEXICON_INVALID", "The publisher repository contains a malformed package profile.");
        }
        return {
            uri: `at://${this.did}/${NSID.packageProfile}/${packageSlug}`,
            cid: record.cid,
            rkey: packageSlug,
            value: parsed.value,
        };
    }
    async getPackageRelease(packageSlug, version) {
        validatePackageSlug(packageSlug);
        const rkey = `${packageSlug}:${version}`;
        const record = await this.#getVerifiedRecord(NSID.packageRelease, rkey);
        const parsed = safeParse(PackageRelease.mainSchema, record.value);
        if (!parsed.ok) {
            throw new DirectPdsReadError("RELEASE_LEXICON_INVALID", "The publisher repository contains a malformed package release.");
        }
        return {
            uri: `at://${this.did}/${NSID.packageRelease}/${rkey}`,
            cid: record.cid,
            rkey,
            value: parsed.value,
        };
    }
    async getPackageRepository(packageSlug) {
        validatePackageSlug(packageSlug);
        const publisher = await this.#getResolvedPublisher();
        const url = new URL("/xrpc/com.atproto.sync.getRepo", publisher.pds);
        url.searchParams.set("did", this.did);
        const response = await this.#fetch(url, {
            method: "GET",
            headers: { Accept: "application/vnd.ipld.car" },
        });
        if (response.status === 404) {
            throw new DirectPdsReadError("REPOSITORY_NOT_FOUND", "The publisher PDS does not contain the requested repository.", 404);
        }
        if (!response.ok) {
            throw new DirectPdsReadError("PDS_REQUEST_FAILED", `The publisher PDS returned HTTP ${response.status}.`, response.status);
        }
        const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
        if (contentType !== "application/vnd.ipld.car") {
            throw new DirectPdsReadError("PDS_RESPONSE_TYPE_INVALID", "The publisher PDS did not return an AT Protocol repository export.");
        }
        const carBytes = new Uint8Array(await response.arrayBuffer());
        try {
            let profilePresent = false;
            const releases = [];
            const stream = new Response(carBytes).body;
            if (stream === null)
                throw new Error("Repository export is empty");
            for await (const entry of fromStream(stream)) {
                if (entry.collection === NSID.packageProfile && entry.rkey === packageSlug) {
                    profilePresent = true;
                    continue;
                }
                if (entry.collection !== NSID.packageRelease)
                    continue;
                const prefix = `${packageSlug}:`;
                if (!entry.rkey.startsWith(prefix))
                    continue;
                const parsedRelease = safeParse(PackageRelease.mainSchema, entry.record);
                if (!parsedRelease.ok ||
                    parsedRelease.value.package !== packageSlug ||
                    entry.rkey !== `${packageSlug}:${parsedRelease.value.version}`) {
                    throw new DirectPdsReadError("RELEASE_LEXICON_INVALID", "The publisher repository contains a malformed package release.");
                }
                releases.push({
                    uri: `at://${this.did}/${NSID.packageRelease}/${entry.rkey}`,
                    cid: entry.cid.$link,
                    rkey: entry.rkey,
                    value: parsedRelease.value,
                });
            }
            if (!profilePresent) {
                throw new DirectPdsReadError("RECORD_NOT_FOUND", "The publisher repository does not contain the requested package profile.");
            }
            const verifiedProfile = await verifyRecord({
                did: this.did,
                collection: NSID.packageProfile,
                rkey: packageSlug,
                publicKey: publisher.publicKey,
                carBytes,
            });
            const parsedProfile = safeParse(PackageProfile.mainSchema, verifiedProfile.record);
            if (!parsedProfile.ok) {
                throw new DirectPdsReadError("PROFILE_LEXICON_INVALID", "The publisher repository contains a malformed package profile.");
            }
            return {
                profile: {
                    uri: `at://${this.did}/${NSID.packageProfile}/${packageSlug}`,
                    cid: verifiedProfile.cid,
                    rkey: packageSlug,
                    value: parsedProfile.value,
                },
                releases,
            };
        }
        catch (error) {
            if (error instanceof DirectPdsReadError)
                throw error;
            throw new DirectPdsReadError("RECORD_PROOF_INVALID", "The publisher repository export or commit signature is invalid.");
        }
    }
    async #getResolvedPublisher() {
        this.#resolvedPublisher ??= this.#resolvePublisher();
        const pendingPublisher = this.#resolvedPublisher;
        try {
            return await pendingPublisher;
        }
        catch (error) {
            if (this.#resolvedPublisher === pendingPublisher)
                this.#resolvedPublisher = undefined;
            throw error;
        }
    }
    async #resolvePublisher() {
        let document;
        try {
            document = await this.#resolver.resolve(this.did);
        }
        catch (error) {
            if (error instanceof DirectPdsReadError)
                throw error;
            throw new DirectPdsReadError("DID_RESOLUTION_FAILED", "The publisher DID document could not be resolved.");
        }
        if (document.id !== this.did) {
            throw new DirectPdsReadError("DID_DOCUMENT_INVALID", "The resolved DID document does not match the publisher DID.");
        }
        const endpoint = getPdsEndpoint(document);
        if (!endpoint) {
            throw new DirectPdsReadError("PDS_ENDPOINT_MISSING", "The publisher DID document has no AT Protocol PDS endpoint.");
        }
        const pds = parsePdsEndpoint(endpoint);
        const material = getAtprotoVerificationMaterial(document);
        if (!material) {
            throw new DirectPdsReadError("DID_SIGNING_KEY_MISSING", "The publisher DID document has no AT Protocol signing key.");
        }
        try {
            const found = getPublicKeyFromDidController(material);
            if (found.type === "p256") {
                return { pds, publicKey: await P256PublicKey.importRaw(found.publicKeyBytes) };
            }
            if (found.type === "secp256k1") {
                return { pds, publicKey: await Secp256k1PublicKey.importRaw(found.publicKeyBytes) };
            }
            const exhaustive = found;
            throw new Error(`Unsupported signing key: ${String(exhaustive)}`);
        }
        catch {
            throw new DirectPdsReadError("DID_SIGNING_KEY_INVALID", "The publisher DID document contains an unsupported signing key.");
        }
    }
    async #getVerifiedRecord(collection, rkey) {
        const publisher = await this.#getResolvedPublisher();
        const url = new URL("/xrpc/com.atproto.sync.getRecord", publisher.pds);
        url.searchParams.set("did", this.did);
        url.searchParams.set("collection", collection);
        url.searchParams.set("rkey", rkey);
        const response = await this.#fetch(url, {
            method: "GET",
            headers: { Accept: "application/vnd.ipld.car" },
        });
        if (response.status === 404) {
            throw new DirectPdsReadError("RECORD_NOT_FOUND", "The publisher repository does not contain the requested record.", 404);
        }
        if (!response.ok) {
            throw new DirectPdsReadError("PDS_REQUEST_FAILED", `The publisher PDS returned HTTP ${response.status}.`, response.status);
        }
        const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
        if (contentType !== "application/vnd.ipld.car") {
            throw new DirectPdsReadError("PDS_RESPONSE_TYPE_INVALID", "The publisher PDS did not return an AT Protocol repository proof.");
        }
        const carBytes = new Uint8Array(await response.arrayBuffer());
        try {
            const verified = await verifyRecord({
                did: this.did,
                collection,
                rkey,
                publicKey: publisher.publicKey,
                carBytes,
            });
            return { cid: verified.cid, value: verified.record };
        }
        catch {
            throw new DirectPdsReadError("RECORD_PROOF_INVALID", "The publisher repository proof or commit signature is invalid.");
        }
    }
}
function isAtprotoDid(value) {
    return isDid(value) && (value.startsWith("did:plc:") || value.startsWith("did:web:"));
}
function parsePdsEndpoint(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw invalidPdsEndpoint();
    }
    if (url.protocol !== "https:" ||
        url.username !== "" ||
        url.password !== "" ||
        url.pathname !== "/" ||
        url.search !== "" ||
        url.hash !== "") {
        throw invalidPdsEndpoint();
    }
    return url;
}
function invalidPdsEndpoint() {
    return new DirectPdsReadError("PDS_ENDPOINT_INVALID", "The publisher DID document contains an invalid PDS endpoint.");
}
function validatePackageSlug(value) {
    if (!PACKAGE_SLUG.test(value))
        throw new TypeError("packageSlug is invalid");
}
function createBoundedFetch(fetchImplementation, options) {
    return async (input, init = {}) => {
        const controller = new AbortController();
        let timedOut = false;
        const cleanupSignals = forwardAbortSignals([options.signal, init.signal].filter((signal) => signal !== undefined), controller);
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, options.requestTimeoutMs);
        try {
            if (controller.signal.aborted)
                throw new DOMException("Aborted", "AbortError");
            const response = await withAbortSignal(Promise.resolve().then(() => fetchImplementation(input, { ...init, signal: controller.signal })), controller.signal);
            const contentLength = response.headers.get("content-length");
            if (contentLength !== null) {
                const declaredLength = Number(contentLength);
                if (!DIGITS.test(contentLength) ||
                    !Number.isSafeInteger(declaredLength) ||
                    declaredLength > options.maxResponseBytes) {
                    void response.body?.cancel().catch(() => undefined);
                    throw responseTooLarge();
                }
            }
            const body = await readBoundedBody(response.body, options.maxResponseBytes, controller.signal);
            return new Response(body.length === 0 ? null : body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        }
        catch (error) {
            if (error instanceof DirectPdsReadError)
                throw error;
            if (timedOut) {
                throw new DirectPdsReadError("PDS_REQUEST_TIMEOUT", "The direct PDS request timed out.");
            }
            if (controller.signal.aborted) {
                throw new DirectPdsReadError("PDS_REQUEST_ABORTED", "The direct PDS request was aborted.");
            }
            throw new DirectPdsReadError("PDS_REQUEST_FAILED", "The direct PDS request failed.");
        }
        finally {
            clearTimeout(timeout);
            cleanupSignals();
        }
    };
}
async function readBoundedBody(body, maximumBytes, signal) {
    if (body === null)
        return new Uint8Array();
    const reader = body.getReader();
    const chunks = [];
    let length = 0;
    let completed = false;
    try {
        for (;;) {
            const chunk = await withAbortSignal(reader.read(), signal);
            if (chunk.done) {
                completed = true;
                break;
            }
            length += chunk.value.length;
            if (length > maximumBytes)
                throw responseTooLarge();
            chunks.push(chunk.value);
        }
    }
    finally {
        if (!completed)
            void reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}
function withAbortSignal(operation, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) {
            abort();
        }
        else {
            signal.addEventListener("abort", abort, { once: true });
        }
        void operation.then((value) => {
            signal.removeEventListener("abort", abort);
            resolve(value);
            return undefined;
        }, (error) => {
            signal.removeEventListener("abort", abort);
            reject(error);
            return undefined;
        });
    });
}
function forwardAbortSignals(signals, controller) {
    const abort = () => controller.abort();
    for (const signal of signals) {
        if (signal.aborted)
            controller.abort();
        else
            signal.addEventListener("abort", abort, { once: true });
    }
    return () => {
        for (const signal of signals)
            signal.removeEventListener("abort", abort);
    };
}
function validatePositiveSafeInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(`${name} must be a positive safe integer`);
    }
}
function responseTooLarge() {
    return new DirectPdsReadError("PDS_RESPONSE_TOO_LARGE", "The direct PDS response exceeded its byte limit.");
}
