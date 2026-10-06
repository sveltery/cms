// TEST ONLY: no credential is created or returned. Observe the actual caller then fail.
export const controlledAttempts: unknown[] = [];
export async function createPasskey(options: unknown): Promise<never> {
  controlledAttempts.push(options);
  throw new Error('Native controlled test stops before credential creation');
}
