import { apiFetch } from './editor-taxonomy-api-host';
import type { EditorTaxonomyClient } from '../../src/lib/taxonomy-editor/types';
async function response<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await apiFetch(path, init);
	const payload = await res.json();
	if (!res.ok) throw new Error(payload.error?.message ?? 'Request failed');
	return payload.data as T;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
/** Whole Source fixture transport only. No production REST/storage/auth credit. */
export const sourceFixtureClient: EditorTaxonomyClient = {
	async definitions() { return (await response<{ taxonomies: Awaited<ReturnType<EditorTaxonomyClient['definitions']>> }>('/_emdash/api/taxonomies')).taxonomies; },
	async terms(taxonomy, locale) {
		const path = `/_emdash/api/taxonomies/${taxonomy}/terms?includeCounts=false${locale ? `&resolveFallback=true&locale=${encodeURIComponent(locale)}` : ''}`;
		return (await response<{ terms: Awaited<ReturnType<EditorTaxonomyClient['terms']>> }>(path)).terms;
	},
	entryTerms(collection, id, taxonomy) { return response(`/_emdash/api/content/${collection}/${id}/terms/${taxonomy}`); },
	async setEntryTerms(collection, id, taxonomy, termIds) {
		const res = await apiFetch(`/_emdash/api/content/${collection}/${id}/terms/${taxonomy}`, post({ termIds }));
		if (!res.ok) { const payload = await res.json(); throw new Error(payload.error?.message ?? 'Failed to set entry terms'); }
	},
	async createTerm(taxonomy, input) { return (await response<{ term: Awaited<ReturnType<EditorTaxonomyClient['createTerm']>> }>(`/_emdash/api/taxonomies/${taxonomy}/terms`, post(input))).term; },
	async createTranslation(taxonomy, slug, sourceLocale, targetLocale) {
		return (await response<{ term: Awaited<ReturnType<EditorTaxonomyClient['createTranslation']>> }>(`/_emdash/api/taxonomies/${taxonomy}/terms/${slug}/translations?locale=${encodeURIComponent(sourceLocale)}`, post({ locale: targetLocale }))).term;
	}
};
