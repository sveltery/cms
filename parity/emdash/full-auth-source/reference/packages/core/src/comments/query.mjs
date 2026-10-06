/**
 * Comment query functions for Astro templates
 *
 * Same pattern as getMenu() — uses getDb() for ambient DB access.
 * These are called from .astro pages/components, not from API routes.
 */
import { CommentReactionRepository } from "../database/repositories/comment-reaction.js";
import { CommentRepository } from "../database/repositories/comment.js";
import { getDb } from "../loader.js";
import { cachedQuery, CacheNamespace } from "../object-cache/index.js";
import { reactionScore } from "./ranking.js";
/**
 * Get approved comments for a content item.
 *
 * @example
 * ```ts
 * import { getComments } from "emdash";
 *
 * const { items, total } = await getComments({
 *   collection: "posts",
 *   contentId: post.id,
 *   threaded: true,
 * });
 * ```
 */
export async function getComments(options) {
    // The result varies by every option getCommentsWithDb branches on, so all of
    // them belong in the key. `best` implies reactions, so normalize the reaction
    // flag — `{ sort: "best" }` and `{ sort: "best", reactions: true }` produce
    // identical output and should share one entry.
    const sort = options.sort ?? "oldest";
    const withReactions = options.reactions || sort === "best";
    const threaded = options.threaded ? "t" : "f";
    return cachedQuery({
        namespace: CacheNamespace.COMMENTS,
        key: `comments:${options.collection}:${options.contentId}:${threaded}:${withReactions ? "r" : "n"}:${sort}`,
        load: async () => {
            const db = await getDb();
            return getCommentsWithDb(db, options);
        },
    });
}
/**
 * Get approved comments with an explicit db handle.
 *
 * @internal Use `getComments()` in templates. This variant is for routes
 * that already have a database handle.
 */
export async function getCommentsWithDb(db, options) {
    const repo = new CommentRepository(db);
    const total = await repo.countByContent(options.collection, options.contentId, "approved");
    // Server-rendered: fetch all comments (capped for safety).
    // The API route handles paginated access; this is for full-page renders.
    const MAX_COMMENTS = 500;
    const result = await repo.findByContent(options.collection, options.contentId, {
        status: "approved",
        limit: MAX_COMMENTS,
    });
    const items = options.threaded
        ? CommentRepository.assembleThreads(result.items).map((c) => CommentRepository.toPublicComment(c))
        : result.items.map((c) => CommentRepository.toPublicComment(c));
    // `best` sort needs reaction data, so it implies reactions.
    if (options.reactions || options.sort === "best") {
        await attachReactions(db, items);
        if (options.sort === "best") {
            sortByBest(items);
        }
    }
    return { items, total };
}
/**
 * Attach aggregate reaction counts to a list of public comments (and their
 * replies), in a single batched query.
 */
async function attachReactions(db, items) {
    const ids = [];
    for (const comment of items) {
        ids.push(comment.id);
        if (comment.replies) {
            for (const reply of comment.replies)
                ids.push(reply.id);
        }
    }
    if (ids.length === 0)
        return;
    const counts = await new CommentReactionRepository(db).countsForComments(ids);
    const assign = (comment) => {
        const reactions = counts.get(comment.id);
        if (reactions)
            comment.reactions = reactions;
    };
    for (const comment of items) {
        assign(comment);
        comment.replies?.forEach(assign);
    }
}
/**
 * Sort top-level comments by Wilson-scored reactions (descending), tie-broken
 * by oldest-first to keep ordering stable.
 */
function sortByBest(items) {
    items.sort((a, b) => {
        const scoreDelta = reactionScore(b.reactions ?? {}) - reactionScore(a.reactions ?? {});
        if (scoreDelta !== 0)
            return scoreDelta;
        if (a.createdAt < b.createdAt)
            return -1;
        if (a.createdAt > b.createdAt)
            return 1;
        return 0;
    });
}
/**
 * Get the count of approved comments for a content item.
 *
 * @example
 * ```ts
 * import { getCommentCount } from "emdash";
 *
 * const count = await getCommentCount("posts", post.id);
 * ```
 */
export async function getCommentCount(collection, contentId) {
    const db = await getDb();
    return getCommentCountWithDb(db, collection, contentId);
}
/**
 * Get comment count with an explicit db handle.
 *
 * @internal Use `getCommentCount()` in templates.
 */
export async function getCommentCountWithDb(db, collection, contentId) {
    const repo = new CommentRepository(db);
    return repo.countByContent(collection, contentId, "approved");
}
