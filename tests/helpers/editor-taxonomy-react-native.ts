import * as React from 'react';
import { mount, unmount } from 'svelte';
import Sidebar from '../../src/lib/ui/EditorTaxonomySidebar.svelte';
import { sourceFixtureClient } from './editor-taxonomy-source-client';
/** Actual product Svelte UI with only the Source fixture client substituted. */
export function TaxonomySidebar(props: Record<string, unknown>) {
	const target = React.useRef<HTMLDivElement>(null);
	React.useLayoutEffect(() => {
		const instance = mount(Sidebar, { target: target.current!, props: {
			collection: String(props.collection), entryId: props.entryId as string | undefined,
			entryLocale: props.entryLocale as string | undefined, defaultLocale: props.defaultLocale as string | undefined,
			canManageTaxonomies: props.canManageTaxonomies === true,
			onChange: props.onChange as ((taxonomy: string, ids: string[]) => void) | undefined,
			client: sourceFixtureClient
		} });
		return () => { void unmount(instance); };
	}, []);
	return React.createElement('div', { ref: target });
}
