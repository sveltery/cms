// Structural host type for the pinned text extraction module. Runtime algorithms
// and the toolkit dependency are unchanged; the richer editor owns its schemas.
export interface PortableTextBlock { _type: string; [key: string]: unknown }
