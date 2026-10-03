export type ApiResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string; details?: Record<string, unknown> } };
export interface CacheHint { tags: string[] }
