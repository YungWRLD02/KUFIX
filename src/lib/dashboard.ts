import { db } from '@/db';
import { users, providers, bookings, quoteRequests, quotes, reviews, supportRequests, serviceCategories } from '@/db/schema';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { getAllCategories } from '@/lib/marketplace';

export type DashboardUser = typeof users.$inferSelect;
export type DashboardData = {
  provider: typeof providers.$inferSelect | undefined;
  categories: (typeof serviceCategories.$inferSelect)[];
  providers: (typeof providers.$inferSelect)[];
  bookings: (typeof bookings.$inferSelect)[];
  requests: (typeof quoteRequests.$inferSelect)[];
  quotes: (typeof quotes.$inferSelect)[];
  reviews: (typeof reviews.$inferSelect)[];
  support: (typeof supportRequests.$inferSelect)[];
  users: (typeof users.$inferSelect)[];
  customerNames: { id: string; name: string }[];
};

export async function loadDashboardData(user: DashboardUser): Promise<DashboardData> {
  const catalogue = await getAllCategories();
  const providerRows = await db.select().from(providers).orderBy(desc(providers.createdAt));
  const provider = providerRows.find(p => p.userId === user.id);
  if (user.role === 'admin') {
    const [allUsers, allBookings, requests, allQuotes, allReviews, support] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(bookings).orderBy(desc(bookings.createdAt)),
      db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt)),
      db.select().from(quotes).orderBy(desc(quotes.createdAt)),
      db.select().from(reviews).orderBy(desc(reviews.createdAt)),
      db.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)),
    ]);
    return { provider, categories: catalogue, providers: providerRows, bookings: allBookings, requests, quotes: allQuotes, reviews: allReviews, support, users: allUsers, customerNames: allUsers.map(u => ({ id: u.id, name: u.name })) };
  }
  const support = await db.select().from(supportRequests).where(eq(supportRequests.userId, user.id)).orderBy(desc(supportRequests.createdAt));
  if (user.role === 'provider' && provider) {
    const [ownBookings, ownQuotes, ownReviews] = await Promise.all([
      db.select().from(bookings).where(eq(bookings.providerId, provider.id)).orderBy(desc(bookings.createdAt)),
      db.select().from(quotes).where(eq(quotes.providerId, provider.id)).orderBy(desc(quotes.createdAt)),
      db.select().from(reviews).where(eq(reviews.providerId, provider.id)).orderBy(desc(reviews.createdAt)),
    ]);
    const requestIds = ownQuotes.map(q => q.requestId);
    const conditions = requestIds.length ? or(and(eq(quoteRequests.category, provider.category), eq(quoteRequests.status, 'Open')), inArray(quoteRequests.id, requestIds)) : and(eq(quoteRequests.category, provider.category), eq(quoteRequests.status, 'Open'));
    const requests = await db.select().from(quoteRequests).where(conditions).orderBy(desc(quoteRequests.createdAt));
    const customerIds = [...new Set(ownBookings.map(b => b.customerId))];
    const customerNames = customerIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, customerIds)) : [];
    return { provider, categories: catalogue, providers: providerRows, bookings: ownBookings, requests, quotes: ownQuotes, reviews: ownReviews, support, users: [], customerNames };
  }
  if (user.role === 'provider') return { provider, categories: catalogue, providers: providerRows, bookings: [], requests: [], quotes: [], reviews: [], support, users: [], customerNames: [] };
  const [ownBookings, requests, ownReviews] = await Promise.all([
    db.select().from(bookings).where(eq(bookings.customerId, user.id)).orderBy(desc(bookings.createdAt)),
    db.select().from(quoteRequests).where(eq(quoteRequests.customerId, user.id)).orderBy(desc(quoteRequests.createdAt)),
    db.select().from(reviews).where(eq(reviews.customerId, user.id)).orderBy(desc(reviews.createdAt)),
  ]);
  const requestIds = requests.map(r => r.id);
  const ownQuotes = requestIds.length ? await db.select().from(quotes).where(inArray(quotes.requestId, requestIds)).orderBy(desc(quotes.createdAt)) : [];
  return { provider, categories: catalogue, providers: providerRows, bookings: ownBookings, requests, quotes: ownQuotes, reviews: ownReviews, support, users: [], customerNames: [] };
}
