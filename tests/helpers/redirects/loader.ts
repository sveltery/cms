// Source-shaped unit transport only. Original whole tests replace this loader
// with their original getDb mock; native middleware never imports it.
export async function getDb(): Promise<never> {
  throw new Error('No Source-shaped test database was supplied');
}
