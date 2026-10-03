import type { CommentSettingsCollection } from '../../../src/lib/comments/settings-types.ts';
export function settingsNavigationState(collection:CommentSettingsCollection){const state=$state({data:{collection,basePath:'/cms',mutationsEnabled:true}});return state;}
