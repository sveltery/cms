// Ported from EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/components/editor/GalleryNode.tsx
// MIT license: notices/emdash-MIT.txt.



/** One image inside a gallery block — mirrors the Portable Text shape. */
export interface GalleryImage {
	_type: "image";
	_key: string;
	asset: {
		_type?: "reference";
		_ref: string;
		url?: string;
		/** Provider ID for external media (e.g., "cloudflare-images") */
		provider?: string;
	};
	alt?: string;
	caption?: string;
	width?: number;
	height?: number;
	focalX?: number;
	focalY?: number;
	/** LQIP blurhash placeholder (images only) */
	blurhash?: string;
	/** LQIP dominant-color placeholder, as a CSS color (images only) */
	dominantColor?: string;
}
