// Native fixture transport for the complete real Vite ES module graph.
// No inlining, module emulation or Worker compatibility/security changes.
import assert from 'node:assert/strict';
export interface BuiltWorkerChunk {fileName:string;code:string;isEntry:boolean}
export interface FixtureWorkerModule {type:'ESModule';path:string;contents:string}
export const fixtureModulesRoot='/cms-vite-worker';
export function viteWorkerModules(chunks:readonly BuiltWorkerChunk[],root=fixtureModulesRoot,entryName?:string):FixtureWorkerModule[] {
 assert.equal(chunks.filter(chunk=>chunk.isEntry).length,1);
 assert.equal(new Set(chunks.map(chunk=>chunk.fileName)).size,chunks.length);
 for(const chunk of chunks)assert.doesNotMatch(chunk.code,/node:sqlite/);
 const ordered=[...chunks].sort((a,b)=>Number(b.isEntry)-Number(a.isEntry));
 return ordered.map(chunk=>({type:'ESModule',path:`${root}/${chunk.isEntry&&entryName?entryName:chunk.fileName}`,contents:chunk.code}));
}
