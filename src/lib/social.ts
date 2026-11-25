import { db } from '@/db';
import { postLikes, postComments, users } from '@/db/schema';
import { and, eq, count, inArray } from 'drizzle-orm';

export type PostKind = 'work' | 'job';

export async function getPostEngagement(kind: PostKind, postId: string | string[], userId: string | null) {
  const ids = Array.isArray(postId) ? postId : [postId];
  if (!ids.length) return { counts: new Map<string, { likes: number; comments: number; liked: boolean }>(), comments: new Map<string, { id: string; body: string; name: string; createdAt: Date; mine: boolean }[]>() };
  const likes = await db.select({ postId: postLikes.postId, count: count() }).from(postLikes).where(and(eq(postLikes.postType, kind), inArray(postLikes.postId, ids))).groupBy(postLikes.postId);
  const userLikes = userId ? await db.select().from(postLikes).where(and(eq(postLikes.postType, kind), inArray(postLikes.postId, ids), eq(postLikes.userId, userId))) : [];
  const comments = await db.select().from(postComments).where(and(eq(postComments.postType, kind), inArray(postComments.postId, ids)));
  const commentUserIds = [...new Set(comments.map(c => c.userId))];
  const commentUsers = commentUserIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, commentUserIds)) : [];
  const likedSet = new Set(userLikes.map(l => l.postId));
  const counts = new Map<string, { likes: number; comments: number; liked: boolean }>();
  for (const id of ids) counts.set(id, { likes: 0, comments: 0, liked: likedSet.has(id) });
  for (const l of likes) counts.get(l.postId)!.likes = Number(l.count);
  const commentMap = new Map<string, typeof comments>();
  for (const c of comments) { const list = commentMap.get(c.postId) || []; list.push(c); commentMap.set(c.postId, list); }
  const commentSummaries = new Map<string, { id: string; body: string; name: string; createdAt: Date; mine: boolean }[]>();
  for (const [id, list] of commentMap) {
    commentSummaries.set(id, list.slice(-20).map(c => ({ id: c.id, body: c.body, name: commentUsers.find(u => u.id === c.userId)?.name || 'Reader', createdAt: c.createdAt, mine: c.userId === userId })));
    counts.get(id)!.comments = list.length;
  }
  return { counts, comments: commentSummaries };
}
