// Existing actual Main faithful API error parser, copied byte-for-byte below from sections-widgets/client.ts.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export class ApiResponseError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message); this.name = 'ApiResponseError';
  }
}
export async function throwResponseError(response: Response, fallback: string): Promise<never> {
  const body: unknown = await response.json().catch(() => ({}));
  let message: string | undefined;
  let code = 'UNKNOWN_ERROR';
  let details: Record<string, unknown> | undefined;
  if (isRecord(body) && isRecord(body.error)) {
    const error = body.error;
    if (error.code === 'VALIDATION_ERROR' && isRecord(error.details) && Array.isArray(error.details.issues)) {
      const issues = error.details.issues.flatMap((issue: unknown) => {
        if (!isRecord(issue) || typeof issue.message !== 'string') return [];
        return [typeof issue.path === 'string' && issue.path.length ? `${issue.path}: ${issue.message}` : issue.message];
      });
      if (issues.length) message = issues.join('; ');
    }
    if (!message && error.code === 'SAVE_REJECTED' && isRecord(error.details) && typeof error.details.pluginId === 'string' && typeof error.details.reason === 'string' && error.details.pluginId.length && error.details.reason.length) {
      message = `Plugin ${error.details.pluginId} rejected the save: ${error.details.reason}`;
    }
    if (!message && typeof error.message === 'string') message = error.message;
    if (typeof error.code === 'string') code = error.code;
    if (isRecord(error.details)) details = error.details;
  }
  throw new ApiResponseError(response.status, code, message || `${fallback}: ${response.statusText}`, details);
}
export async function parseApiResponse<T>(response: Response, fallback = 'Request failed'): Promise<T> {
  if (!response.ok) await throwResponseError(response, fallback);
  const body: { data: T } = await response.json();
  return body.data;
}
