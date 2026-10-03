// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete declarations from 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/cloudflare/src/image-endpoint.ts; only dependency bindings are native.
import type {Storage} from '../source/storage/types.ts';
import type {ImageOutputOptions, ImageTransform} from '@cloudflare/workers-types';
import {matchInternalMediaKey,MUTABLE_MEDIA_CACHE_CONTROL,originalMediaHeaders,parseTransformParams,resolveTransformQuality,type ImageTransformFormat} from '../source/media/image-endpoint.ts';
import type {NativeImagesBinding as ImagesBinding} from './types.ts';
export type APIRoute=(ctx:{request:Request;locals:{emdash?:{storage?:Storage}}})=>Promise<Response>;

export function createWorkerImageEndpoint({adapterGET,env}:{adapterGET:APIRoute;env:Record<string,unknown>}):APIRoute{
const FORMAT_MIME: Record<ImageTransformFormat, ImageOutputOptions["format"]> = {
	webp: "image/webp",
	avif: "image/avif",
	jpeg: "image/jpeg",
	png: "image/png",
};

function resolveImagesBinding(): ImagesBinding | undefined {
	const configured = (globalThis as { __ASTRO_IMAGES_BINDING_NAME?: unknown })
		.__ASTRO_IMAGES_BINDING_NAME;
	const name = typeof configured === "string" && configured ? configured : "IMAGES";
	// env from cloudflare:workers has no index signature, so a cast is needed.
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- Images binding accessed from untyped env object
	return (env as Record<string, unknown>)[name] as ImagesBinding | undefined;
}

function streamOriginal(body: ReadableStream<Uint8Array>, contentType: string): Response {
	return new Response(body, { status: 200, headers: originalMediaHeaders(contentType) });
}

function isNotFound(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.message.includes("not found") || error.message.includes("NOT_FOUND"))
	);
}

const GET: APIRoute = async (ctx) => {
	const url = new URL(ctx.request.url);
	const key = matchInternalMediaKey(url.searchParams.get("href"));
	// App.Locals.emdash is augmented by `emdash/locals`, not loaded in this
	// package's compilation; narrow to the field we need.
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- App.Locals augmentation lives in the emdash package
	const storage = (ctx.locals as { emdash?: { storage?: Storage | null } }).emdash?.storage;

	// Not EmDash media, or storage unavailable: let the adapter's endpoint handle
	// it (bundled assets via ASSETS, allowed remote via fetch).
	if (!key || !storage) return adapterGET(ctx);

	try {
		const source = await storage.download(key);

		// Only raster images are transformable; serve anything else unchanged.
		if (!source.contentType.startsWith("image/")) {
			return streamOriginal(source.body, source.contentType);
		}

		const images = resolveImagesBinding();
		const parsed = parseTransformParams(url.searchParams);

		// No binding or unparseable params: serve the original so the URL resolves.
		if (!images || !parsed.ok) {
			return streamOriginal(source.body, source.contentType);
		}

		const { width, height, format, quality } = parsed.options;
		const outputMime = FORMAT_MIME[format] ?? "image/webp";
		const transform: ImageTransform = {};
		if (width) transform.width = width;
		if (height) transform.height = height;
		// Lossy formats get an explicit quality: the Images binding has no
		// default of its own and encodes near-losslessly without one, producing
		// renditions several times the size of the original. PNG is exempt —
		// an explicit PNG quality switches the binding to lossy PNG8, which is
		// not a safe default for a lossless format. An explicit `?q=` always wins.
		const output: ImageOutputOptions = { format: outputMime };
		const effectiveQuality = resolveTransformQuality(format, quality);
		if (effectiveQuality !== undefined) output.quality = effectiveQuality;

		const result = await images.input(source.body).transform(transform).output(output);
		const response = result.response();
		if (!response.body) return new Response(null, { status: 500 });

		return new Response(response.body, {
			status: 200,
			headers: {
				"Content-Type": response.headers.get("Content-Type") ?? outputMime,
				"Cache-Control": MUTABLE_MEDIA_CACHE_CONTROL,
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		if (isNotFound(error)) return new Response("Not Found", { status: 404 });
		console.error("[emdash] image transform failed:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
return GET;
}
