<script lang="ts">
 import type {Snippet} from 'svelte';
 let {label,onclose,dismissible=true,role='dialog',children}:{label:string;onclose:()=>void;dismissible?:boolean;role?:'dialog'|'alertdialog';children:Snippet}=$props();
 let dialog:HTMLDialogElement;
 $effect(()=>{dialog.showModal();return()=>dialog.close();});
</script>
<dialog bind:this={dialog} {role} aria-label={label} class="media-dialog" oncancel={event=>{event.preventDefault();if(dismissible)onclose();}}>
 {@render children()}
</dialog>
<style>dialog{width:min(calc(100% - 2rem),600px);max-height:90vh;overflow:auto;padding:1.5rem;background:white;color:inherit;border:0;border-radius:.8rem}dialog::backdrop{background:#0008}</style>
