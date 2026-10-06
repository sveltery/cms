/**
 * WordPress import and source probing APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
async function executeWpPluginImportChunk(url, token, config, phase, cursor, state) {
    const response = await apiFetch(`${API_BASE}/import/wordpress-plugin/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url,
            token,
            config,
            phase,
            cursor,
            idMap: state.idMap,
            translationGroups: state.translationGroups,
            commentRoots: state.commentRoots,
        }),
    });
    return parseApiResponse(response, "Failed to import from WordPress");
}
/** Merge a chunk's partial result into the running aggregate. */
function mergeImportResults(into, chunk) {
    into.imported += chunk.imported;
    into.skipped += chunk.skipped;
    into.errors.push(...chunk.errors);
    for (const [collection, count] of Object.entries(chunk.byCollection)) {
        into.byCollection[collection] = (into.byCollection[collection] || 0) + count;
    }
    if (chunk.taxonomyAssignments) {
        into.taxonomyAssignments = (into.taxonomyAssignments ?? 0) + chunk.taxonomyAssignments;
    }
    if (chunk.missingTaxonomies?.length) {
        into.missingTaxonomies = [
            ...new Set([...(into.missingTaxonomies ?? []), ...chunk.missingTaxonomies]),
        ];
    }
    if (chunk.taxonomiesCreated?.length) {
        into.taxonomiesCreated = [...(into.taxonomiesCreated ?? []), ...chunk.taxonomiesCreated];
    }
    if (chunk.menus)
        into.menus = chunk.menus;
    if (chunk.comments) {
        into.comments = {
            imported: (into.comments?.imported ?? 0) + chunk.comments.imported,
            skipped: (into.comments?.skipped ?? 0) + chunk.comments.skipped,
        };
    }
    if (chunk.siteSettings)
        into.siteSettings = chunk.siteSettings;
    if (chunk.sections) {
        into.sections = {
            created: (into.sections?.created ?? 0) + chunk.sections.created,
            skipped: (into.sections?.skipped ?? 0) + chunk.sections.skipped,
        };
    }
    if (chunk.taxonomies) {
        into.taxonomies ??= {
            termsCreated: {},
            termsReused: {},
            assignments: 0,
            missingTaxonomies: [],
        };
        for (const [taxonomy, count] of Object.entries(chunk.taxonomies.termsCreated)) {
            into.taxonomies.termsCreated[taxonomy] =
                (into.taxonomies.termsCreated[taxonomy] ?? 0) + count;
        }
        for (const [taxonomy, count] of Object.entries(chunk.taxonomies.termsReused)) {
            into.taxonomies.termsReused[taxonomy] = (into.taxonomies.termsReused[taxonomy] ?? 0) + count;
        }
        into.taxonomies.assignments += chunk.taxonomies.assignments;
        into.taxonomies.missingTaxonomies = [
            ...new Set([...into.taxonomies.missingTaxonomies, ...chunk.taxonomies.missingTaxonomies]),
        ];
    }
    into.success = into.errors.length === 0;
}
/**
 * Run the full plugin import as a sequence of bounded requests: content
 * pages, then comment pages, then finalize (menus + site identity).
 * Each request stays well below Worker resource limits regardless of
 * site size. Re-running after an abort is safe: `skipExisting` skips
 * already-imported content while rebuilding the ID maps the later
 * phases need.
 */
export async function executeWpPluginImport(url, token, config, onProgress) {
    const aggregate = {
        success: true,
        imported: 0,
        skipped: 0,
        errors: [],
        byCollection: {},
    };
    const state = { idMap: {}, translationGroups: {}, commentRoots: {} };
    let comments = 0;
    const runPhase = async (phase) => {
        let cursor;
        let done = false;
        while (!done) {
            const chunk = await executeWpPluginImportChunk(url, token, config, phase, cursor, state);
            mergeImportResults(aggregate, chunk.result);
            Object.assign(state.idMap, chunk.chunk?.idMap);
            Object.assign(state.translationGroups, chunk.chunk?.translationGroups);
            Object.assign(state.commentRoots, chunk.chunk?.commentRoots);
            comments += (chunk.result.comments?.imported ?? 0) + (chunk.result.comments?.skipped ?? 0);
            onProgress?.({
                phase,
                processed: aggregate.imported + aggregate.skipped,
                comments,
            });
            done = chunk.done;
            cursor = chunk.cursor;
        }
    };
    await runPhase("content");
    await runPhase("comments");
    await runPhase("finalize");
    return aggregate;
}
/**
 * Analyze a WordPress WXR file
 */
export async function analyzeWxr(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiFetch(`${API_BASE}/import/wordpress/analyze`, {
        method: "POST",
        body: formData,
    });
    return parseApiResponse(response, "Failed to analyze file");
}
/**
 * Prepare WordPress import (create collections/fields)
 */
export async function prepareWxrImport(request) {
    const response = await apiFetch(`${API_BASE}/import/wordpress/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
    return parseApiResponse(response, "Failed to prepare import");
}
async function executeWxrImportChunk(file, config, phase, cursor, chunk) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("config", JSON.stringify(config));
    formData.append("phase", phase);
    if (cursor)
        formData.append("cursor", JSON.stringify(cursor));
    if (chunk)
        formData.append("chunk", JSON.stringify(chunk));
    const response = await apiFetch(`${API_BASE}/import/wordpress/execute`, {
        method: "POST",
        body: formData,
    });
    return parseApiResponse(response, "Failed to import");
}
export async function executeWxrImport(file, config, onProgress) {
    const aggregate = {
        success: true,
        imported: 0,
        skipped: 0,
        errors: [],
        byCollection: {},
    };
    let cursor;
    let state;
    let done = false;
    onProgress?.({ phase: "taxonomy", processed: 0, comments: 0 });
    const prepared = await executeWxrImportChunk(file, config, "taxonomy");
    mergeImportResults(aggregate, prepared.result);
    cursor = prepared.cursor;
    state = prepared.chunk;
    if (!cursor)
        throw new Error(i18n._(msg `The import did not return a preparation cursor`));
    while (!done) {
        const response = await executeWxrImportChunk(file, config, "content", cursor, state);
        mergeImportResults(aggregate, response.result);
        cursor = response.cursor;
        state = response.chunk;
        done = response.done;
        onProgress?.({
            phase: "content",
            processed: aggregate.imported + aggregate.skipped,
            comments: 0,
        });
    }
    if (!cursor)
        throw new Error(i18n._(msg `The import did not return a completion cursor`));
    onProgress?.({
        phase: "sections",
        processed: aggregate.imported + aggregate.skipped,
        comments: 0,
    });
    const finalized = await executeWxrImportChunk(file, config, "finalize", cursor, state);
    mergeImportResults(aggregate, finalized.result);
    return aggregate;
}
/**
 * Import media from WordPress with streaming progress
 *
 * @param attachments - Array of attachments to import
 * @param onProgress - Callback for progress updates (optional)
 * @returns Final import result
 */
export async function importWxrMedia(attachments, onProgress) {
    const response = await apiFetch(`${API_BASE}/import/wordpress/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachments, stream: !!onProgress }),
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to import media`));
    // If no progress callback, just parse as JSON (non-streaming mode)
    // Note: streaming NDJSON responses are excluded from the { success, data } envelope
    if (!onProgress) {
        return parseApiResponse(response, "Failed to import media");
    }
    // Streaming mode: read NDJSON line by line
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("Response body is not readable");
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let result = null;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === "progress") {
                    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- SSE event data is parsed JSON; discriminated by type === "progress"
                    onProgress(parsed);
                }
                else if (parsed.type === "result" || parsed.imported) {
                    // Final result (has type: "result" or is the result object)
                    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- SSE event data is parsed JSON; discriminated by type === "result"
                    result = parsed;
                }
            }
            catch {
                // Ignore parse errors for incomplete JSON
                console.warn("Failed to parse NDJSON line:", line);
            }
        }
    }
    // Process any remaining data in buffer
    if (buffer.trim()) {
        try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === "result" || parsed.imported) {
                // eslint-disable-next-line typescript/no-unsafe-type-assertion -- SSE event data is parsed JSON; discriminated by type === "result"
                result = parsed;
            }
        }
        catch {
            console.warn("Failed to parse final NDJSON:", buffer);
        }
    }
    if (!result) {
        throw new Error("No result received from media import");
    }
    return result;
}
/** Attachments per media request. Bounds each Worker invocation (issue #475). */
const MEDIA_BATCH_SIZE = 25;
/**
 * Import media in bounded batches instead of one giant request, so each
 * Worker invocation stays below resource limits and an aborted run only
 * loses the batch in flight (the server dedupes re-sent files by content
 * hash). Progress is reported against the overall total.
 */
export async function importWxrMediaBatched(attachments, onProgress) {
    const merged = { imported: [], failed: [], urlMap: {} };
    for (let offset = 0; offset < attachments.length; offset += MEDIA_BATCH_SIZE) {
        const batch = attachments.slice(offset, offset + MEDIA_BATCH_SIZE);
        const result = await importWxrMedia(batch, onProgress &&
            ((progress) => onProgress({
                ...progress,
                current: offset + progress.current,
                total: attachments.length,
            })));
        merged.imported.push(...result.imported);
        merged.failed.push(...result.failed);
        Object.assign(merged.urlMap, result.urlMap);
    }
    return merged;
}
/**
 * Probe a URL to detect import source
 */
export async function probeImportUrl(url) {
    const response = await apiFetch(`${API_BASE}/import/probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });
    const data = await parseApiResponse(response, "Failed to probe URL");
    return data.result;
}
/**
 * Rewrite URLs in content after media import
 */
export async function rewriteContentUrls(urlMap, collections) {
    const response = await apiFetch(`${API_BASE}/import/wordpress/rewrite-urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlMap, collections }),
    });
    return parseApiResponse(response, "Failed to rewrite URLs");
}
/**
 * Analyze a WordPress site with EmDash Exporter plugin
 */
export async function analyzeWpPluginSite(url, token) {
    const response = await apiFetch(`${API_BASE}/import/wordpress-plugin/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token }),
    });
    const data = await parseApiResponse(response, "Failed to analyze WordPress site");
    return data.analysis;
}
