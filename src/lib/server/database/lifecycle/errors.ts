import { EmDashValidationError } from './upstream/database/repositories/types.ts';

/** Source-qualified public lifecycle refusal, separate from storage errors. */
export class LifecycleSlugConflictError extends Error {
  readonly code='SLUG_CONFLICT';
  constructor(message:string) {super(message);this.name='LifecycleSlugConflictError';}

  /** Pinned API publish catch recognizes only this structured discriminant. */
  static fromValidation(error:EmDashValidationError):LifecycleSlugConflictError|undefined {
    const details=error.details;
    return typeof details==='object'&&details!==null&&'code' in details&&details.code==='SLUG_CONFLICT'
      ?new LifecycleSlugConflictError(error.message):undefined;
  }
}
