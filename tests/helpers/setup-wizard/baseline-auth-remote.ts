// Test-only inert remote-form shape for mounting the current real PasskeySetup.
// No Source wizard assertion submits this baseline form. Submission rejects.
const field = (name: string) => ({ as: (type: string, value?: string) => ({ name, type, value }) });
function form(fields: Record<string, ReturnType<typeof field>>) {
  return { fields: { ...fields, allIssues: () => [] }, pending: 0, result: undefined,
    enhance: () => ({}), submit: async () => { throw new Error('Baseline form submission is outside this UI fixture'); } };
}
export const beginSetup = form({ email: field('email'), name: field('name') });
export const completeSetup = form({ credential: field('credential') });
