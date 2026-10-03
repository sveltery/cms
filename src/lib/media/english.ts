/** Explicit native English binding for source API fallback strings; no Lingui parity claim. */
export function msg(strings:TemplateStringsArray,...values:unknown[]):string{return strings.reduce((text,string,index)=>text+string+(index<values.length?String(values[index]):''),'');}
export const i18n={_: (message:string)=>message};
