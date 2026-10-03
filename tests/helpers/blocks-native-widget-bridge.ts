import {native} from './blocks-react-bridge.ts';
import BlockSubField from '../../src/lib/ui/BlockSubField.svelte';
import BlockMediaField from '../../src/lib/ui/BlockMediaField.svelte';
import BlockTypeEditor from '../../src/lib/ui/BlockTypeEditor.svelte';
export function NativeBlockSubField(props:Record<string,unknown>){return native(BlockSubField,props);}
export function NativeBlockMediaField(props:Record<string,unknown>){return native(BlockMediaField,props);}
export function NativeBlockTypeEditor(props:Record<string,unknown>){return native(BlockTypeEditor,props);}
