/** Native domain transport for the pinned setup route's inner apply catch.
 * The HTTP owner must pass cause to the original handler to preserve its exact
 * error class/details/status behavior. Load/override/validation stay unwrapped. */
export class SetupSeedApplyError extends Error {
  declare readonly cause: unknown;
  constructor(cause: unknown) {
    super('Setup seed application failed', { cause });
    this.name = 'SetupSeedApplyError';
  }
}
