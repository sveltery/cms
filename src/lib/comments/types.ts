// Whole selected pinned Source declarations, EmDash MIT Cloudflare 2026.


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommentStatus = "pending" | "approved" | "spam" | "trash";


export interface AdminComment {
	id: string;
	collection: string;
	contentId: string;
	parentId: string | null;
	authorName: string;
	authorEmail: string;
	authorUserId: string | null;
	body: string;
	status: CommentStatus;
	ipHash: string | null;
	userAgent: string | null;
	moderationMetadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
}


export type CommentCounts = Record<CommentStatus, number>;


export type BulkAction = "approve" | "spam" | "trash" | "delete";


// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CommentInboxProps {
	comments: AdminComment[];
	counts: CommentCounts;
	isLoading: boolean;
	nextCursor?: string;
	collections: Record<string, { label: string }>;
	activeStatus: CommentStatus;
	onStatusChange: (status: CommentStatus) => void;
	collectionFilter: string;
	onCollectionFilterChange: (collection: string) => void;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onCommentStatusChange: (id: string, status: CommentStatus) => Promise<unknown>;
	onCommentDelete: (id: string) => Promise<unknown>;
	onBulkAction: (ids: string[], action: BulkAction) => Promise<unknown>;
	onLoadMore: () => void;
	isAdmin: boolean;
	isStatusPending: boolean;
	deleteError: unknown;
	onDeleteErrorReset: () => void;
}
