import type { Collection } from '../server/database/contract.ts';
// Supplied-value presentation also retains Source admin's code-defined label.
export type CommentSettingsCollection=Pick<Collection,'slug'|'label'|'version'|'updatedAt'|'commentsEnabled'|'commentsModeration'|'commentsClosedAfterDays'|'commentsAutoApproveUsers'>&{source:string};
export type CommentSettingsInput=Pick<CommentSettingsCollection,'commentsEnabled'|'commentsModeration'|'commentsClosedAfterDays'|'commentsAutoApproveUsers'>;
