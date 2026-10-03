import type { EmailMessage } from './types.ts';
/** Native supplied email provider; absence is unavailable, never a successful send. */
export interface EmailPipeline {
  isAvailable(): boolean;
  send(message: EmailMessage, source: string): Promise<unknown>;
}
