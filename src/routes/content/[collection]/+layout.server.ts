import type { LayoutServerLoad } from './$types';
import { editorCapability } from '$lib/server/content/editor-display';
export const load: LayoutServerLoad = ({ locals }) => ({ editorCapability: editorCapability(locals.cms) });
