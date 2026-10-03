import {render} from 'svelte/server';
import type {Component} from 'svelte';
/** Fixture transport: real Svelte SSR replaces Astro container, no mocked HTML. */
export const NativeSearchContainer={async create(){return{async renderToString(component:Component<Record<string,unknown>>,{props}:{props:Record<string,unknown>;locals:Record<string,unknown>}){return render(component,{props}).body;}};}};
