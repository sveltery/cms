// Runner-only matcher adapter for unchanged Vitest dashboard callback bodies.
import assert from 'node:assert/strict';
import {it as nodeIt} from 'node:test';
const token=Symbol('dashboard runner matcher');
function equal(actual:any,expected:any):boolean {
 if(expected?.[token]==='any')return expected.value===String?typeof actual==='string':expected.value===Number?typeof actual==='number':actual instanceof expected.value;
 if(expected?.[token]==='object')return actual!==null&&typeof actual==='object'&&Object.entries(expected.value).every(([key,value])=>equal(actual[key],value));
 if(expected?.[token]==='array')return Array.isArray(actual)&&expected.value.every((value:any)=>actual.some(item=>equal(item,value)));
 if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((value,index)=>equal(actual[index],value));
 if(expected!==null&&typeof expected==='object')return actual!==null&&typeof actual==='object'&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([key,value])=>Object.hasOwn(actual,key)&&equal(actual[key],value));
 return Object.is(actual,expected);
}
function match(actual:any,negate=false):any {
 const check=(value:boolean,message:string)=>assert.equal(value,!negate,message);
 return {get not(){return match(actual,!negate);},
 toBe(expected:any){check(Object.is(actual,expected),`Expected ${actual} to be ${expected}`);},
 toEqual(expected:any){check(equal(actual,expected),`Expected matching value: ${JSON.stringify(actual)}`);},
 toBeDefined(){check(actual!==undefined,'Expected defined');},
 toHaveLength(expected:number){check(actual.length===expected,`Expected length${expected}`);},
 toBeGreaterThanOrEqual(expected:number){check(actual>=expected,`Expected >=${expected}`);},
 toContain(expected:any){check(actual.includes(expected),'Expected member');},
 toMatchObject(expected:any){check(equal(actual,{[token]:'object',value:expected}),'Expected object subset');},
 toHaveProperty(key:string){check(Object.hasOwn(actual,key),`Expected property${key}`);}
 };
}
export const expect=Object.assign((actual:any)=>match(actual),{
 any:(value:any)=>({[token]:'any',value}),objectContaining:(value:any)=>({[token]:'object',value}),arrayContaining:(value:any)=>({[token]:'array',value})
});
export const it=nodeIt;
