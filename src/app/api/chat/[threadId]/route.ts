import { db } from '@/db';
import { chatMessages, chatThreads, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getUser, getUserFromToken, setSession } from '@/lib/auth';
import { canAccessThread } from '@/lib/community';
import { isSameOrigin } from '@/lib/request-security';
import { isDemoUser } from '@/lib/demo';

export const dynamic = 'force-dynamic';
const uid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUser(request: Request, token: string | null) {
  const user = (await getUser()) || (await getUserFromToken(token));
  if (user && isDemoUser(user)) return null;
  if (user && token) await setSession(user.id);
  return user;
}

export async function GET(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  const token = new URL(request.url).searchParams.get('t');
  const user = await resolveUser(request, token);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!uid.test(threadId)) return Response.json({ error: 'not found' }, { status: 404 });
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  if (!thread || !(await canAccessThread(user, thread))) return Response.json({ error: 'forbidden' }, { status: 403 });
  const messages = await db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(chatMessages.createdAt);
  const senderIds = [...new Set(messages.map(m => m.senderId))];
  const senders = senderIds.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, senderIds)) : [];
  return Response.json({ messages: messages.map(m => ({ id: m.id, body: m.body, senderId: m.senderId, sender: m.senderId === user.id ? 'You' : (senders.find(s => s.id === m.senderId)?.role === 'admin' ? 'KUFIX Customer Care' : senders.find(s => s.id === m.senderId)?.name || 'Participant'), createdAt: m.createdAt })), me: user.id, status: thread.status });
}

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: 'invalid origin' }, { status: 403 });
  const { threadId } = await context.params;
  if (!uid.test(threadId)) return Response.json({ error: 'not found' }, { status: 404 });
  const contentType = request.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await request.json().catch(() => ({})) : Object.fromEntries((await request.formData()).entries());
  const body = String((data as { body?: string }).body || '').trim();
  const token = String((data as { t?: string }).t || new URL(request.url).searchParams.get('t') || '');
  const user = await resolveUser(request, token);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  if (!thread || !(await canAccessThread(user, thread))) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!body) return Response.json({ error: 'Message cannot be empty' }, { status: 400 });
  if (body.length > 2000) return Response.json({ error: 'Message is too long (max 2000 characters)' }, { status: 400 });
  const [created] = await db.insert(chatMessages).values({ threadId, senderId: user.id, body }).returning();
  await db.update(chatThreads).set({ updatedAt: new Date(), status: 'Open' }).where(eq(chatThreads.id, threadId));
  return Response.json({ message: { id: created.id, body: created.body, senderId: user.id, sender: user.name, createdAt: created.createdAt }, me: user.id });
}
