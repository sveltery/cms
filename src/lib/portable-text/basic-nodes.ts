import {Node,mergeAttributes} from '@tiptap/core';
// Native DOM nodes preserve cached Portable Text metadata. Media/section/plugin
// provider workflows remain separate integrations until their real clients land.
export const PortableImage=Node.create({
  name:'image',group:'block',atom:true,
  addAttributes(){return Object.fromEntries(['src','alt','title','caption','mediaId','provider','width','height','displayWidth','displayHeight','alignment','link','blurhash','dominantColor'].map(key=>[key,{default:null}]));},
  parseHTML(){return [{tag:'img[src]'}];},
  renderHTML({HTMLAttributes}){return ['img',mergeAttributes(HTMLAttributes)];}
});
export const PortablePluginBlock=Node.create({
  name:'pluginBlock',group:'block',atom:true,
  addAttributes(){return {blockType:{default:'embed'},id:{default:''},data:{default:{}}};},
  parseHTML(){return [{tag:'div[data-plugin-block]'}];},
  renderHTML({node}){return ['div',{'data-plugin-block':''},String(node.attrs.blockType)];}
});
