import type { CommentSettingsCollection } from '../../../src/lib/comments/settings-types.ts';
export function settingsNavigationState(collection:CommentSettingsCollection){return $state({data:{collection,basePath:'/cms',mutationsEnabled:true}});}
