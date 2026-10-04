export async function fetchTransferCapabilities(): Promise<unknown> {
  const response = await fetch('/_emdash/api/admin/transfer/capabilities');
  if (!response.ok) throw new Error('Failed to load transfer capabilities');
  return (await response.json()).data;
}
