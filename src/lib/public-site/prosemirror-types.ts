/** Native erasable type host for the whole pinned numbered-list helper. */
export interface ProseMirrorMark { type: string; attrs?: Record<string, unknown> }
export interface ProseMirrorNode {
  type: string; attrs?: Record<string, unknown>; content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[]; text?: string;
}
export interface ProseMirrorDocument { type: 'doc'; content: ProseMirrorNode[] }
