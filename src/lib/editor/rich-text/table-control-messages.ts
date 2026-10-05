// Shared Source descriptors remain independent of editor/menu dependencies.
import type { MessageDescriptor } from '@lingui/core';
import { TABLE_CONTROL_MESSAGE_IDS } from './table-control-messages.source';
export function tableMessage(message: string, values?: MessageDescriptor['values']): MessageDescriptor {
  return { id: TABLE_CONTROL_MESSAGE_IDS[message] ?? message, message, ...(values ? { values } : {}) };
}
