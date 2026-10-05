import Field from '../../../src/lib/schema-admin/FieldEditor.svelte';
import * as client from '../../../src/lib/schema-admin/client';
import { nativeMount } from './mount';
export function FieldEditor(props: object) { return nativeMount(Field, { ...props, client, relationsHref: '/_emdash/admin/content-types/relations' }); }
