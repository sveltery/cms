import List from '../../../src/lib/schema-admin/ContentTypeList.svelte';
import * as client from '../../../src/lib/schema-admin/client';
import { nativeMount } from './mount';
export { moveCollection } from '../../../src/lib/schema-admin/order';
export function ContentTypeList(props: object) { return nativeMount(List, { ...props, client }); }
