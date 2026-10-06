/** Owned collection-deletion adapter imports from the complete pinned Source
 * virtual module contract. Declarations provide no runtime adapter or fallback. */
declare module 'virtual:emdash/config' {
  const config:{database?:{config:unknown}};
  export default config;
}
declare module 'virtual:emdash/dialect' {
  export const executeCollectionDeletionGuard:
    import('./upstream/db/adapters.ts').ExecuteCollectionDeletionGuard|undefined;
}
