import type { Component } from 'svelte';
/** Native component transport; no Astro or React runtime is loaded. */
export namespace JSX { export type Element = Component<Record<string, unknown>>; }
