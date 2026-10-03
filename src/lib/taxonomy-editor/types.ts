/** Native boundary for the complete pinned EmDash editor sidebar port. */
export interface TaxonomyDefinition {
	id: string;
	name: string;
	label: string;
	labelSingular?: string;
	hierarchical: boolean;
	collections: string[];
	locale?: string;
	translationGroup?: string | null;
}
export interface TaxonomyTerm {
	id: string;
	name: string;
	slug: string;
	label: string;
	parentId?: string | null;
	children: TaxonomyTerm[];
	locale: string;
	translationGroup: string | null;
}
export interface UnresolvedAssignment {
	translationGroup: string;
	availableLocales: string[];
	translations: Array<{ id: string; slug: string; locale: string }>;
}
export interface EntryTaxonomyTerms {
	terms: TaxonomyTerm[];
	unresolved: UnresolvedAssignment[];
	entryLocale: string;
	defaultLocale: string;
	implicitDefaultLocale: boolean;
}
export interface EditorTaxonomyClient {
	definitions(): Promise<TaxonomyDefinition[]>;
	terms(taxonomy: string, locale?: string): Promise<TaxonomyTerm[]>;
	entryTerms(collection: string, entryId: string, taxonomy: string): Promise<EntryTaxonomyTerms>;
	setEntryTerms(collection: string, entryId: string, taxonomy: string, termIds: string[]): Promise<void>;
	createTerm(taxonomy: string, input: { label: string; locale?: string }): Promise<TaxonomyTerm>;
	createTranslation(taxonomy: string, slug: string, sourceLocale: string, targetLocale: string): Promise<TaxonomyTerm>;
}
export function flattenTerms(terms: TaxonomyTerm[], depth = 0): Array<{ term: TaxonomyTerm; depth: number }> {
	return terms.flatMap((term) => [{ term, depth }, ...flattenTerms(term.children, depth + 1)]);
}
