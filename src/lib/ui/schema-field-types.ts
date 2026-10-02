// Pinned EmDash field families; native form labels are a framework substitution.
export const schemaFieldTypes = [
  ['string','Short text'], ['text','Long text'], ['url','URL'], ['number','Number'],
  ['integer','Integer'], ['boolean','Boolean'], ['datetime','Date and time'],
  ['select','Select'], ['multiSelect','Multi select'], ['portableText','Rich text'],
  ['image','Image'], ['file','File'], ['reference','Reference'], ['json','JSON'],
  ['slug','Slug'], ['repeater','Repeater'], ['blocks','Blocks']
] as const;
