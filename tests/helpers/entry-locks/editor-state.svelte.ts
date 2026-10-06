import type {EditorRecord} from '../../../src/lib/editor/session.ts';
/** Controlled reactive props only; the actual mounted editor/controller remain their owners. */
export function entryLockEditorState(initial:EditorRecord){
 let value=$state(initial);return{get entry(){return value;},set entry(next:EditorRecord){value=next;}};
}
