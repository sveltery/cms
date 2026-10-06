/**
 * Media Provider Types
 *
 * Media providers are pluggable sources for browsing, uploading, and embedding media.
 * They enable integration with external services (Unsplash, Cloudinary, Mux, etc.)
 * alongside the built-in local media library.
 */
import { normalizeFocalPoint } from "./focal-point.js";
/**
 * Convert a MediaProviderItem to a MediaValue for storage
 */
export function mediaItemToValue(providerId, item) {
    const focalPoint = normalizeFocalPoint(item.focalX, item.focalY);
    return {
        provider: providerId,
        id: item.id,
        filename: item.filename,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
        ...focalPoint,
        blurhash: item.blurhash,
        dominantColor: item.dominantColor,
        alt: item.alt,
        meta: item.meta,
    };
}
