import type {ContentSeo,PublicPageContext,PageMetadataContribution,SeoSettings}from './types.ts';
export function generateBaseSeoContributions(_page:PublicPageContext,_defaultOgImage?:string|null):PageMetadataContribution[]{return [];}
export function generateSiteSeoContributions(_settings:SeoSettings|undefined):PageMetadataContribution[]{return [];}
export function applySeoPanelToPageContext(page:PublicPageContext,_seo:ContentSeo,_options:{siteUrl?:string|null}={}):PublicPageContext{return page;}
