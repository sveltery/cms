/** Source-qualified public lifecycle refusal, separate from storage errors. */
export class LifecycleSlugConflictError extends Error {
  readonly code='SLUG_CONFLICT';
  constructor(message:string) {super(message);this.name='LifecycleSlugConflictError';}
}
