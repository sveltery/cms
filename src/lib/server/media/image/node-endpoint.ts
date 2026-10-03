// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete declarations from 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/image-endpoint.ts; only dependency bindings are native.
import type {Storage} from '../source/storage/types.ts';
import {matchInternalMediaKey,MUTABLE_MEDIA_CACHE_CONTROL,originalMediaHeaders,parseTransformParams,resolveTransformQuality,type ImageTransformFormat} from '../source/media/image-endpoint.ts';
import type {NativeImageService} from './types.ts';
export type APIRoute=(ctx:{request:Request;locals:{emdash?:{storage?:Storage}}})=>Promise<Response>;

export function createNodeImageEndpoint({genericGET,getConfiguredImageService,imageConfig}:{genericGET:APIRoute;getConfiguredImageService:()=>Promise<NativeImageService>;imageConfig:unknown}):APIRoute{
const FORMAT_MIME: Record<string, string> = {
	webp: "image/webp",
	avif: "image/avif",
	png: "image/png",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	gif: "image/gif",
};

function isNotFound(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.message.includes("not found") || error.message.includes("NOT_FOUND"))
	);
}

function streamOriginal(body: ReadableStream<Uint8Array>, contentType: string): Response {
	return new Response(body, { status: 200, headers: originalMediaHeaders(contentType) });
}

const GET: APIRoute = async (ctx) => {
	const url = new URL(ctx.request.url);
	const key = matchInternalMediaKey(url.searchParams.get("href"));
	const storage = ctx.locals.emdash?.storage;

	// Not EmDash media, or storage unavailable: let the stock endpoint handle it
	// (bundled assets, allowed remote, `publicUrl` media).
	if (!key || !storage) return genericGET(ctx);

	const service = await getConfiguredImageService();
	if (!("transform" in service)) return genericGET(ctx);

	try {
		const source = await storage.download(key);

		// Only raster images are transformable; serve anything else unchanged.
		if (!source.contentType.startsWith("image/")) {
			return streamOriginal(source.body, source.contentType);
		}

		const transform = await service.parseURL(url, imageConfig);
		if (!transform) return streamOriginal(source.body, source.contentType);

		const inputBuffer = new Uint8Array(await new Response(source.body).arrayBuffer());
		const { data, format } = await service.transform(inputBuffer, transform, imageConfig);

		return new Response(data, {
			status: 200,
			headers: {
				"Content-Type": FORMAT_MIME[format] ?? source.contentType,
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
