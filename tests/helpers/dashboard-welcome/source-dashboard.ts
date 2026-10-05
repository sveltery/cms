// Original Source tests mock these functions. They never return manufactured data.
export async function fetchDashboardStats(): Promise<unknown> {
  const response = await fetch('/_emdash/api/dashboard');
  if (!response.ok) throw new Error('Failed to fetch dashboard stats');
  return (await response.json()).data;
}
export async function dismissScheduledPolicyRejection(collection: string, id: string, revision: string): Promise<void> {
  const response = await fetch(`/_emdash/api/admin/scheduled-policy-rejections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?rev=${encodeURIComponent(revision)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to dismiss scheduled publication rejection');
}
