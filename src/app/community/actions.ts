'use server';

import { db } from '@/db';
import { jobPosts, jobOffers, workPosts, bookings, chatThreads, chatMessages, providers, users } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireFormUser } from '@/lib/auth';
import { isDemoUser } from '@/lib/demo';
import { getCategories } from '@/lib/marketplace';
import { findOrCreateProviderThread, findOrCreateSupportThread, getProviderForUser } from '@/lib/community';

const val = (data: FormData, key: string) => String(data.get(key) || '').trim();
const uid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function token(data: FormData) { return String(data.get('t') || ''); }
function go(data: FormData, query: string): never {
  const t = token(data);
  revalidatePath('/dashboard'); revalidatePath('/jobs');
  redirect(`/dashboard?${query}${t ? `&t=${encodeURIComponent(t)}` : ''}`);
}
function denyDemo(user: { id: string }, data: FormData) { if (isDemoUser(user)) go(data, 'notice=demo'); }

export async function postJobAction(data: FormData) {
  const user = await requireFormUser(data, 'customer'); denyDemo(user, data);
  const title = val(data, 'title'), category = val(data, 'category'), description = val(data, 'description'), location = val(data, 'location');
  const budget = val(data, 'budget'), urgency = ['Flexible', 'This week', 'Urgent'].includes(val(data, 'urgency')) ? val(data, 'urgency') : 'Flexible';
  const categories = await getCategories();
  if (!title || title.length > 160 || !description || description.length > 4000 || !location || location.length > 200 || !categories.some(c => c.name === category) || budget.length > 60) go(data, 'tab=posts&error=' + encodeURIComponent('Please complete the job details with a valid service category.'));
  await db.insert(jobPosts).values({ customerId: user.id, title, category, description, location, budget: budget || null, urgency });
  revalidatePath('/jobs'); go(data, 'tab=posts&success=' + encodeURIComponent('Your request is live on the job board.'));
}

export async function closeJobAction(data: FormData) {
  const user = await requireFormUser(data, 'customer'); denyDemo(user, data);
  const id = val(data, 'id'); if (!uid.test(id)) go(data, 'tab=posts&error=' + encodeURIComponent('Request not found.'));
  await db.update(jobPosts).set({ status: 'Closed' }).where(and(eq(jobPosts.id, id), eq(jobPosts.customerId, user.id)));
  revalidatePath('/jobs'); go(data, 'tab=posts&success=' + encodeURIComponent('Request closed.'));
}

export async function offerOnJobAction(data: FormData) {
  const user = await requireFormUser(data, 'provider'); denyDemo(user, data);
  const provider = await getProviderForUser(user.id);
  const jobId = val(data, 'jobId'), price = Number(val(data, 'price')), message = val(data, 'message');
  if (!provider) go(data, 'tab=posts&error=' + encodeURIComponent('Complete your provider profile before offering to help.'));
  if (!uid.test(jobId) || !price || price < 1 || !message || message.length > 2000) go(data, 'tab=posts&error=' + encodeURIComponent('Add a price and a short message.'));
  const [job] = await db.select().from(jobPosts).where(eq(jobPosts.id, jobId)).limit(1);
  if (!job || job.status !== 'Open' || job.category !== provider!.category) go(data, 'tab=posts&error=' + encodeURIComponent('This request is not open for your service category.'));
  const [existing] = await db.select().from(jobOffers).where(and(eq(jobOffers.jobId, jobId), eq(jobOffers.providerId, provider!.id))).limit(1);
  if (existing) await db.update(jobOffers).set({ price: String(price), message }).where(eq(jobOffers.id, existing.id));
  else await db.insert(jobOffers).values({ jobId, providerId: provider!.id, price: String(price), message });
  revalidatePath('/jobs'); revalidatePath('/professionals'); go(data, 'tab=posts&success=' + encodeURIComponent('Your offer has been sent to the customer.'));
}

export async function acceptJobOfferAction(data: FormData) {
  const user = await requireFormUser(data, 'customer'); denyDemo(user, data);
  const id = val(data, 'id'); if (!uid.test(id)) go(data, 'tab=bookings&error=' + encodeURIComponent('Offer not found.'));
  const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, id)).limit(1);
  if (!offer) go(data, 'tab=bookings&error=' + encodeURIComponent('Offer not found.'));
  const [job] = await db.select().from(jobPosts).where(and(eq(jobPosts.id, offer.jobId), eq(jobPosts.customerId, user.id))).limit(1);
  if (!job || job.status !== 'Open') go(data, 'tab=bookings&error=' + encodeURIComponent('This request is no longer open.'));
  await db.transaction(async tx => {
    await tx.update(jobOffers).set({ status: 'Accepted' }).where(eq(jobOffers.id, id));
    await tx.update(jobOffers).set({ status: 'Declined' }).where(and(eq(jobOffers.jobId, job.id), ne(jobOffers.id, id)));
    await tx.update(jobPosts).set({ status: 'Filled' }).where(eq(jobPosts.id, job.id));
    await tx.insert(bookings).values({ customerId: user.id, providerId: offer.providerId, service: job.category, description: `${job.title}\n\n${job.description}`, date: 'To be arranged', time: 'To be arranged', location: job.location, instructions: `Accepted job-board offer: ₦${offer.price}. ${offer.message}`, status: 'Pending' });
  });
  revalidatePath('/jobs'); go(data, 'tab=bookings&success=' + encodeURIComponent('Offer accepted. A booking request has been created.'));
}

export async function postWorkAction(data: FormData) {
  const user = await requireFormUser(data, 'provider'); denyDemo(user, data);
  const provider = await getProviderForUser(user.id);
  const title = val(data, 'title'), description = val(data, 'description'), location = val(data, 'location'), completedOn = val(data, 'completedOn');
  const imageUrl = val(data, 'imageUrl');
  const categories = await getCategories();
  if (!provider) go(data, 'tab=posts&error=' + encodeURIComponent('Complete your provider profile first.'));
  if (!title || title.length > 160 || !description || description.length > 3000 || !location || location.length > 200 || !completedOn || !/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) go(data, 'tab=posts&error=' + encodeURIComponent('Please complete the job-done details.'));
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) go(data, 'tab=posts&error=' + encodeURIComponent('Image link must start with http:// or https://.'));
  await db.insert(workPosts).values({ providerId: provider!.id, title, category: provider!.category, description, location, completedOn, imageUrl: imageUrl || null });
  revalidatePath('/jobs'); revalidatePath('/professionals'); go(data, 'tab=posts&success=' + encodeURIComponent('Job-done post published.'));
}

export async function hideWorkAction(data: FormData) {
  const user = await requireFormUser(data); denyDemo(user, data);
  const id = val(data, 'id'); if (!uid.test(id)) go(data, 'tab=posts&error=' + encodeURIComponent('Post not found.'));
  const [post] = await db.select().from(workPosts).where(eq(workPosts.id, id)).limit(1);
  if (!post) go(data, 'tab=posts&error=' + encodeURIComponent('Post not found.'));
  if (user.role !== 'admin') {
    const provider = await getProviderForUser(user.id);
    if (!provider || provider.id !== post.providerId) go(data, 'tab=posts&error=' + encodeURIComponent('You can only change your own posts.'));
  }
  await db.update(workPosts).set({ visible: false }).where(eq(workPosts.id, id));
  revalidatePath('/jobs'); revalidatePath('/professionals'); go(data, 'tab=posts&success=' + encodeURIComponent('Job-done post hidden.'));
}

export async function startProviderChatAction(data: FormData) {
  const user = await requireFormUser(data, 'customer'); denyDemo(user, data);
  const providerId = val(data, 'providerId');
  if (!uid.test(providerId)) go(data, 'tab=messages&error=' + encodeURIComponent('Provider not found.'));
  const [provider] = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
  if (!provider?.userId) go(data, 'tab=messages&error=' + encodeURIComponent('This is a sample profile; chat is available for real provider accounts.'));
  const thread = await findOrCreateProviderThread(user.id, providerId, `Chat with ${provider.name}`);
  const opening = val(data, 'message');
  if (opening) await db.insert(chatMessages).values({ threadId: thread.id, senderId: user.id, body: opening.slice(0, 2000) });
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${thread.id}`);
}

export async function startChatWithProviderAction(data: FormData) {
  // A customer chats with a provider (or a provider chats back with the customer's own thread).
  const user = await requireFormUser(data, 'customer'); denyDemo(user, data);
  const providerId = val(data, 'providerId');
  if (!uid.test(providerId)) go(data, 'tab=messages&error=' + encodeURIComponent('Provider not found.'));
  const [provider] = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
  if (!provider?.userId) go(data, 'tab=messages&error=' + encodeURIComponent('Chat is available for real provider accounts.'));
  const thread = await findOrCreateProviderThread(user.id, providerId, `Chat with ${provider.name}`);
  const opening = val(data, 'message');
  if (opening) await db.insert(chatMessages).values({ threadId: thread.id, senderId: user.id, body: opening.slice(0, 2000) });
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${thread.id}`);
}

export async function startProviderChatWithCustomerAction(data: FormData) {
  // Providers can start a conversation with any customer who has booked them
  const user = await requireFormUser(data, 'provider'); denyDemo(user, data);
  const provider = await getProviderForUser(user.id);
  const customerId = val(data, 'customerId');
  if (!provider) go(data, 'tab=messages&error=' + encodeURIComponent('Complete your provider profile first.'));
  if (!uid.test(customerId)) go(data, 'tab=messages&error=' + encodeURIComponent('Customer not found.'));
  const [customer] = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
  if (!customer) go(data, 'tab=messages&error=' + encodeURIComponent('Customer not found.'));
  if (customer.id === user.id) go(data, 'tab=messages&error=' + encodeURIComponent('You cannot start a chat with yourself.'));
  // only allow chatting with customers who booked this provider
  const booking = await db.select().from(bookings).where(and(eq(bookings.providerId, provider.id), eq(bookings.customerId, customerId))).limit(1);
  if (!booking.length) go(data, 'tab=messages&error=' + encodeURIComponent('You can only message customers who have booked you.'));
  const thread = await findOrCreateProviderThread(customerId, provider.id, `Chat with ${customer.name}`);
  const opening = val(data, 'message');
  if (opening) await db.insert(chatMessages).values({ threadId: thread.id, senderId: user.id, body: opening.slice(0, 2000) });
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${thread.id}`);
}

export async function updateThreadStatusAction(data: FormData) {
  const user = await requireFormUser(data); denyDemo(user, data);
  const threadId = val(data, 'threadId'); const status = val(data, 'status');
  if (!uid.test(threadId) || !['Open', 'Resolved'].includes(status)) return;
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  if (!thread) return;
  const allowed = thread.createdBy === user.id || thread.customerId === user.id;
  if (!allowed && user.role !== 'admin') return;
  // admins may update support threads; anyone may update their own provider threads
  if (thread.kind === 'support' && user.role !== 'admin') return;
  await db.update(chatThreads).set({ status }).where(eq(chatThreads.id, threadId));
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${threadId}`);
}

export async function startChatFromBookingAction(data: FormData) {
  const user = await requireFormUser(data, 'provider'); denyDemo(user, data);
  const provider = await getProviderForUser(user.id);
  const bookingId = val(data, 'bookingId');
  if (!provider || !uid.test(bookingId)) go(data, 'tab=messages&error=' + encodeURIComponent('Booking not found.'));
  const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id))).limit(1);
  if (!booking) go(data, 'tab=messages&error=' + encodeURIComponent('Booking not found.'));
  const [customer] = await db.select().from(users).where(eq(users.id, booking.customerId)).limit(1);
  const thread = await findOrCreateProviderThread(booking.customerId, provider.id, `Chat with ${customer?.name || 'Customer'}`);
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${thread.id}`);
}

export async function startSupportChatAction(data: FormData) {
  const user = await requireFormUser(data); denyDemo(user, data);
  const subject = val(data, 'subject') || 'Customer care enquiry';
  const thread = await findOrCreateSupportThread(user.id, subject);
  const opening = val(data, 'message');
  if (opening) await db.insert(chatMessages).values({ threadId: thread.id, senderId: user.id, body: opening.slice(0, 2000) });
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${thread.id}`);
}

export async function replySupportAction(data: FormData) {
  const user = await requireFormUser(data, 'admin'); denyDemo(user, data);
  const threadId = val(data, 'threadId'); if (!uid.test(threadId)) go(data, 'tab=messages');
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  if (!thread || thread.kind !== 'support') go(data, 'tab=messages&error=' + encodeURIComponent('Support conversation not found.'));
  const body = val(data, 'body'); if (!body) go(data, `tab=messages&thread=${threadId}`);
  await db.insert(chatMessages).values({ threadId, senderId: user.id, body: body.slice(0, 2000) });
  await db.update(chatThreads).set({ updatedAt: new Date(), status: val(data, 'status') === 'Resolved' ? 'Resolved' : 'Open' }).where(eq(chatThreads.id, threadId));
  revalidatePath('/dashboard'); go(data, `tab=messages&thread=${threadId}&success=` + encodeURIComponent('Reply sent.'));
}
