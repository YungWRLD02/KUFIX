'use server';

import { db } from '@/db';
import { postLikes, postComments, workPosts, jobPosts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFormUser } from '@/lib/auth';
import { isDemoUser } from '@/lib/demo';

const val = (data: FormData, key: string) => String(data.get(key) || '').trim();
const uid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function denyDemo(user: { id: string }, data: FormData) {
  if (isDemoUser(user)) redirect(`/dashboard?notice=demo&t=${encodeURIComponent(val(data, 't'))}`);
}

function refresh() {
  revalidatePath('/dashboard'); revalidatePath('/jobs');
}

export async function toggleLikeAction(data: FormData) {
  const user = await requireFormUser(data);
  denyDemo(user, data);
  const postType = val(data, 'postType') as 'work' | 'job';
  const postId = val(data, 'postId');
  const referrer = val(data, 'referrer');
  const t = val(data, 't');
  if (!['work', 'job'].includes(postType) || !uid.test(postId)) return;
  const count = postType === 'work'
    ? (await db.select().from(workPosts).where(eq(workPosts.id, postId)).limit(1)).length
    : (await db.select().from(jobPosts).where(eq(jobPosts.id, postId)).limit(1)).length;
  if (!count) return;
  const [existing] = await db.select().from(postLikes).where(and(eq(postLikes.postType, postType), eq(postLikes.postId, postId), eq(postLikes.userId, user.id))).limit(1);
  if (existing) await db.delete(postLikes).where(eq(postLikes.id, existing.id));
  else await db.insert(postLikes).values({ postType, postId, userId: user.id });
  refresh();
  const qs = `postType=${postType}&postId=${postId}${t ? `&t=${encodeURIComponent(t)}` : ''}`;
  if (referrer === '/jobs') redirect(`/jobs?${qs}`);
  redirect(`/dashboard?tab=posts&${qs}`);
}

export async function addCommentAction(data: FormData) {
  const user = await requireFormUser(data);
  denyDemo(user, data);
  const postType = val(data, 'postType') as 'work' | 'job';
  const postId = val(data, 'postId');
  const body = val(data, 'body');
  const referrer = val(data, 'referrer');
  const t = val(data, 't');
  if (!['work', 'job'].includes(postType) || !uid.test(postId)) return;
  const count = postType === 'work'
    ? (await db.select().from(workPosts).where(eq(workPosts.id, postId)).limit(1)).length
    : (await db.select().from(jobPosts).where(eq(jobPosts.id, postId)).limit(1)).length;
  if (!count) return;
  if (!body || body.length > 1000) {
    refresh();
    redirect(referrer === '/jobs' ? `/jobs?error=${encodeURIComponent('Add a comment (max 1000 characters).')}&${postType}=${postType}&${postId}=${postId}` : `/dashboard?tab=posts&error=${encodeURIComponent('Add a comment (max 1000 characters).')}`);
  }
  await db.insert(postComments).values({ postType, postId, userId: user.id, body });
  refresh();
  const qs = `postType=${postType}&postId=${postId}${t ? `&t=${encodeURIComponent(t)}` : ''}`;
  if (referrer === '/jobs') redirect(`/jobs?${qs}`);
  redirect(`/dashboard?tab=posts&${qs}`);
}

export async function deleteCommentAction(data: FormData) {
  const user = await requireFormUser(data);
  denyDemo(user, data);
  const id = val(data, 'id');
  const referrer = val(data, 'referrer');
  const t = val(data, 't');
  if (!uid.test(id)) return;
  const [comment] = await db.select().from(postComments).where(eq(postComments.id, id)).limit(1);
  if (!comment) return;
  if (comment.userId !== user.id && user.role !== 'admin') return;
  await db.delete(postComments).where(eq(postComments.id, id));
  refresh();
  const qs = `postType=${comment.postType}&postId=${comment.postId}${t ? `&t=${encodeURIComponent(t)}` : ''}`;
  if (referrer === '/jobs') redirect(`/jobs?${qs}`);
  redirect(`/dashboard?tab=posts&${qs}`);
}
