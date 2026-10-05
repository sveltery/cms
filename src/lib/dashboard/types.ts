// EmDash 1.1.0, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Dashboard DTOs preserve packages/admin/src/lib/api/dashboard.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
export interface CollectionStats { slug: string; label: string; total: number; published: number; draft: number; scheduled: number; overdueScheduled?: number }
export interface RecentItem { id: string; collection: string; collectionLabel: string; title: string; slug: string | null; status: string; updatedAt: string; authorId: string | null }
export interface DashboardStats {
  collections: CollectionStats[]; mediaCount: number; userCount: number; recentItems: RecentItem[];
  schedulerHealth?: { status: 'healthy' | 'stale' | 'unknown'; lastCompletedAt: string | null };
  policyRejectedScheduled?: number;
  policyRejections?: { collection: string; id: string; pluginId: string; reason: string; rejectedAt: string; _rev: string }[];
}
export interface DashboardManifest {
  collections: Record<string, { label: string; labelSingular?: string; hidden?: boolean; quickCreate?: boolean }>;
  plugins?: Record<string, { enabled?: boolean; dashboardWidgets?: { id: string; title?: string; size?: 'full' | 'half' | 'third' }[] }>;
  marketplace?: boolean;
}
export interface CurrentUser { id: string; email: string; name: string | null; role: number; avatarUrl: string | null; isFirstLogin: boolean }
export interface DashboardClient {
  fetchDashboardStats(): Promise<DashboardStats>;
  fetchTransferCapabilities(): Promise<{ portableDomain: { empty: boolean } }>;
  dismissScheduledPolicyRejection(collection: string, id: string, revision: string): Promise<void>;
}
