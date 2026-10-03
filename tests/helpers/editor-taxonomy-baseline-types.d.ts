/** Test-only virtual import avoids registering a foreign remote in production. */
declare module 'editor-taxonomy-baseline-ui' {
 import type {Component} from 'svelte';
 const Sidebar:Component<{collection:string;id:string;locale:string;disabled:boolean}>;
 export default Sidebar;
}
