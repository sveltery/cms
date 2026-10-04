import type { PageServerLoad } from './$types';
import { editorCapability } from '$lib/server/content/editor-display';
export const load: PageServerLoad = ({ locals }) => ({ editorCapability: editorCapability(locals.cms) });
