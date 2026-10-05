// Pinned Source api/schemas/content.ts ContentSeoInput and common.ts httpUrl.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import * as v from 'valibot';
const httpUrl=v.pipe(v.string(),v.check(value=>{
 try{new URL(value);return /^https?:\/\//i.test(value);}catch{return false;}
},'URL must use http or https'));
export const contentSeoInput=v.object({
 title:v.nullish(v.pipe(v.string(),v.maxLength(200))),
 description:v.nullish(v.pipe(v.string(),v.maxLength(500))),
 image:v.nullish(v.string()),canonical:v.nullish(httpUrl),noIndex:v.optional(v.boolean())
});
