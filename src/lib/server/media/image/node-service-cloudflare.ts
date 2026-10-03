/** Node image codecs are unavailable in workerd; the actual Images factory handles that platform. */
export async function getNativeImageService():Promise<never>{throw new Error('Node image codecs are unavailable on the Cloudflare adapter');}
