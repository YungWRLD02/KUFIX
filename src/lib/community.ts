import { db } from '@/db';
import { users, providers, jobPosts, jobOffers, workPosts, chatThreads, chatMessages } from '@/db/schema';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

export async function getProviderForUser(userId: string) {
  const [provider] = await db.select().from(providers).where(eq(providers.userId, userId)).limit(1);
  return provider;
}

export async function getCommunityData(userId: string, role: string) {
  const providerRows = await db.select().from(providers);
  const provider = providerRows.find(p => p.userId === userId);
  const [allJobs, allOffers, allWork, allThreads, allUsers, allMessages] = await Promise.all([
    db.select().from(jobPosts).orderBy(desc(jobPosts.createdAt)),
    db.select().from(jobOffers).orderBy(desc(jobOffers.createdAt)),
    db.select().from(workPosts).orderBy(desc(workPosts.createdAt)),
    db.select().from(chatThreads).orderBy(desc(chatThreads.updatedAt)),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users),
    db.select().from(chatMessages).orderBy(chatMessages.createdAt),
  ]);
  const threads = role === 'admin' ? allThreads.filter(t => t.kind === 'support') : allThreads.filter(t => t.createdBy === userId || t.customerId === userId || (provider && t.providerId === provider.id));
  const threadIds = threads.map(t => t.id);
  return {
    provider,
    providers: providerRows,
    users: allUsers,
    jobs: role === 'admin' ? allJobs : allJobs,
    offers: allOffers,
    work: allWork,
    threads,
    messages: threadIds.length ? allMessages.filter(m => threadIds.includes(m.threadId)) : [],
  };
}

export type CommunityData = Awaited<ReturnType<typeof getCommunityData>>;

export async function canAccessThread(user: { id: string; role: string }, thread: ChatThread) {
  if (thread.createdBy === user.id || thread.customerId === user.id) return true;
  if (thread.kind === 'support' && user.role === 'admin') return true;
  if (thread.kind === 'provider' && thread.providerId) {
    const [provider] = await db.select().from(providers).where(eq(providers.id, thread.providerId)).limit(1);
    return provider?.userId === user.id;
  }
  return false;
}

export async function getThreadWithMessages(user: { id: string; role: string }, threadId: string) {
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  if (!thread || !(await canAccessThread(user, thread))) return null;
  const messages = await db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(chatMessages.createdAt);
  return { thread, messages };
}

export async function findOrCreateProviderThread(customerId: string, providerId: string, subject: string) {
  const [existing] = await db.select().from(chatThreads).where(and(eq(chatThreads.kind, 'provider'), eq(chatThreads.customerId, customerId), eq(chatThreads.providerId, providerId))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(chatThreads).values({ kind: 'provider', createdBy: customerId, customerId, providerId, subject: subject.slice(0, 180) }).returning();
  return created;
}

export async function findOrCreateSupportThread(userId: string, subject: string) {
  const [existing] = await db.select().from(chatThreads).where(and(eq(chatThreads.kind, 'support'), eq(chatThreads.createdBy, userId), eq(chatThreads.status, 'Open'))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(chatThreads).values({ kind: 'support', createdBy: userId, customerId: userId, subject: subject.slice(0, 180) }).returning();
  return created;
}

export function threadName(thread: ChatThread, providerRows: { id: string; name: string }[], users: { id: string; name: string }[]) {
  if (thread.kind === 'support') return 'KUFIX Customer Care';
  const provider = providerRows.find(p => p.id === thread.providerId);
  if (thread.createdBy === thread.customerId) return provider?.name || 'Professional';
  const customer = users.find(u => u.id === thread.customerId);
  return customer?.name || 'Customer';
}
