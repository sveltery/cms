// Test-only module boundary for byte-preserved untyped published dependency JS.
// This does not claim upstream TypeScript or production provider parity.
declare module 'date-time-reference/nav' {
  import type { ComponentType } from 'react';
  export const Nav: ComponentType<Record<string, unknown>>;
}
declare module 'date-time-reference/previous' {
  import type { ComponentType } from 'react';
  export const PreviousMonthButton: ComponentType<Record<string, unknown>>;
}
declare module 'date-time-reference/next' {
  import type { ComponentType } from 'react';
  export const NextMonthButton: ComponentType<Record<string, unknown>>;
}
declare module 'date-time-reference/context' {
  import type { Context } from 'react';
  export const dayPickerContext: Context<Record<string, unknown> | undefined>;
}
