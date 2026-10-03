<script lang="ts">
  import {onMount,untrack} from 'svelte';
  import {Editor,type JSONContent} from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import CharacterCount from '@tiptap/extension-character-count';
  import {portableTextToProsemirror,prosemirrorToPortableText,equalJsonValues,PortableTextIdentityExtension,PortableTextSpanIdentity,type PortableTextBlock} from '../portable-text/conversion';
  import {countWords} from '../portable-text/metrics';
  import {PortableImage,PortablePluginBlock} from '../portable-text/basic-nodes';
  import PortableTextFooter from './PortableTextFooter.svelte';
  let {value=[],onChange,placeholder,className='',editable=true,focusMode='normal',minimal=false,onEditorReady,'aria-labelledby':labelledby,pluginBlocks=[]}:{
    value?:PortableTextBlock[];onChange?:(value:PortableTextBlock[])=>void;placeholder?:string;className?:string;editable?:boolean;focusMode?:'normal'|'spotlight';minimal?:boolean;
    onEditorReady?:(editor:Editor|null)=>void;'aria-labelledby'?:string;pluginBlocks?:Array<{type:string}>;
  }=$props();
  let target:HTMLDivElement;
  let editor=$state.raw<Editor|null>(null);
  let error=$state<string|undefined>();
  const initial=untrack(()=>value);
  let last=initial;
  onMount(()=>{
    try{
      const content=portableTextToProsemirror(initial,new Set(pluginBlocks.map(block=>block.type)));
      editor=new Editor({element:target,extensions:[StarterKit,PortableTextIdentityExtension,PortableTextSpanIdentity,PortableImage,PortablePluginBlock,CharacterCount.configure({wordCounter:countWords})],
        editable,content:content as JSONContent,editorProps:{attributes:{class:'ProseMirror',dir:'auto'}},
        onUpdate:({editor:active})=>{
          const next=prosemirrorToPortableText(active.getJSON());
          if(!equalJsonValues(next,last)){last=next;onChange?.(next);}
        }
      });
      onEditorReady?.(editor);
    }catch(cause){error=cause instanceof Error?cause.message:'Content cannot be edited safely.';}
    return()=>{onEditorReady?.(null);editor?.destroy();};
  });
  $effect(()=>{editor?.setEditable(editable);});
</script>
{#if error}<p role="alert">{error}</p>{/if}
<div class="{className} {focusMode==='spotlight'?'spotlight-mode':''}" aria-labelledby={labelledby} data-emdash-editor-surface>
  <div bind:this={target}></div>
  {#if editor&&!minimal}<PortableTextFooter {editor}/>{/if}
</div>
