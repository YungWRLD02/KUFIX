'use server';

import { db } from '@/db';
import { users, providers, bookings, quoteRequests, quotes, reviews, supportRequests } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, clearSession, getUser, hashPassword, requireFormUser, requireUser, setSession } from '@/lib/auth';
import { getOrCreateWallet, holdBookingEscrow, releaseEscrow, refundEscrow, formatNaira } from '@/lib/wallet';
import { getProvider } from '@/lib/marketplace';
import { DEMO_PASSWORD, demoAccountByEmail, demoAccountByRole, isDemoUser } from '@/lib/demo';

const val = (data: FormData, key: string) => String(data.get(key) || '').trim();
const error = (path: string, message: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
function formToken(data: FormData) { return String(data.get('t') || ''); }
function dashPath(data: FormData, query: string) { const t = formToken(data); return `/dashboard?${query}${t ? `&t=${encodeURIComponent(t)}` : ''}`; }
function blockDemo(user: { id: string } | null, data?: FormData) { if (isDemoUser(user)) redirect(dashPath(data ?? new FormData(), 'notice=demo')); }

export async function registerAction(data: FormData) {
  const name = val(data, 'name'), email = val(data, 'email').toLowerCase(), phone = val(data, 'phone'), password = val(data, 'password'), location = val(data, 'location') || 'Abuja', role = val(data, 'role') === 'provider' ? 'provider' : 'customer';
  const path = `/signup?role=${role}`;
  if (!name || !email.includes('@') || !phone || password.length < 8) error(path, 'Please complete all fields and use a password of at least 8 characters.');
  if (demoAccountByEmail(email)) error(path, 'That address is reserved for a demo account. Please use your own email.');
  if (role === 'provider' && (!val(data, 'category') || !val(data, 'bio'))) error(path, 'Please add your service category and description.');
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) error(path, 'An account with this email already exists.');
  const [user] = await db.insert(users).values({ name, email, phone, passwordHash: hashPassword(password), role, location }).returning();
  if (role === 'provider') await db.insert(providers).values({ userId: user.id, name, category: val(data, 'category'), location, area: location, bio: val(data, 'bio'), verification: 'Not verified' });
  await setSession(user.id);
  redirect('/dashboard');
}

export async function loginAction(data: FormData) {
  const email = val(data, 'email').toLowerCase(), password = val(data, 'password');
  const demo = demoAccountByEmail(email);
  if (demo) {
    if (password !== DEMO_PASSWORD) error('/login', 'Incorrect email or password.');
    await setSession(demo.id);
    redirect('/dashboard');
  }
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !checkPassword(password, user.passwordHash)) error('/login', 'Incorrect email or password.');
  await setSession(user.id);
  redirect('/dashboard');
}

export async function demoLoginAction(data: FormData) {
  const demo = demoAccountByRole(val(data, 'role'));
  if (!demo) redirect('/login#demo');
  await setSession(demo.id);
  redirect('/dashboard');
}

export async function logoutAction() { await clearSession(); redirect('/'); }

export async function bookingAction(data: FormData) {
  const user = await requireFormUser(data); blockDemo(user, data);
  if (user.role !== 'customer') error('/dashboard', 'Please use a customer account to book a service.');
  const providerId = val(data, 'providerId'); const provider = await getProvider(providerId);
  if (!provider) error('/professionals', 'Provider not found.');
  const service = val(data, 'service'), description = val(data, 'description'), date = val(data, 'date'), time = val(data, 'time'), location = val(data, 'location');
  const price = Number(val(data, 'price'));
  if (!service || !description || !date || !time || !location) error(`/professionals/${providerId}`, 'Please complete all booking fields.');
  if (!price || price < 100 || price > 10000000) error(`/professionals/${providerId}`, 'Enter a service price of at least ₦100.');
  const wallet = await getOrCreateWallet(user.id);
  if (Number(wallet.balance) < price) error(`/professionals/${providerId}`, `Not enough wallet balance for ${formatNaira(price)}. Add funds to your wallet first.`);
  const [created] = await db.insert(bookings).values({ customerId: user.id, providerId, service, description, date, time, location, instructions: val(data, 'instructions'), price: String(price) }).returning();
  const hold = await holdBookingEscrow(created.id, user.id, price);
  if (!hold.ok) {
    await db.delete(bookings).where(eq(bookings.id, created.id));
    error(`/professionals/${providerId}`, hold.reason || 'Unable to hold payment.');
  }
  revalidatePath('/dashboard'); redirect(dashPath(data, 'success=Booking%20request%20submitted.%20Payment%20held%20in%20escrow.'));
}

export async function quoteRequestAction(data: FormData) {
  const user = await requireFormUser(data); blockDemo(user, data);
  if (user.role !== 'customer') error('/dashboard', 'Please use a customer account to request a quote.');
  const category = val(data, 'category'), description = val(data, 'description'), location = val(data, 'location');
  if (!category || !description || !location) error('/request-quote', 'Please complete all required fields.');
  await db.insert(quoteRequests).values({ customerId: user.id, category, description, location });
  revalidatePath('/dashboard'); redirect('/dashboard?success=Quote request posted');
}

export async function bookingStatusAction(data: FormData) {
  const user = await requireFormUser(data); blockDemo(user, data); const id = val(data, 'id'), status = val(data, 'status');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['Accepted', 'Rejected', 'In Progress', 'Completed', 'Cancelled'].includes(status)) return;
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1); if (!booking) return;
  if (user.role === 'provider') {
    const [provider] = await db.select().from(providers).where(and(eq(providers.id, booking.providerId), eq(providers.userId, user.id))).limit(1);
    const allowed: Record<string, string[]> = { Pending: ['Accepted', 'Rejected'], Accepted: ['In Progress'], 'In Progress': ['Completed'] };
    if (!provider || !allowed[booking.status]?.includes(status)) return;
  } else if (user.role === 'customer') {
    if (booking.customerId !== user.id || !((status === 'Cancelled' && ['Pending', 'Accepted', 'Rescheduled', 'In Progress'].includes(booking.status)) || (status === 'Accepted' && booking.status === 'Rescheduled'))) return;
  } else if (user.role !== 'admin') return;
  if (status === 'Rejected' && booking.paymentStatus === 'Held') {
    const refund = await refundEscrow(id);
    if (!refund) return;
  }
  if (status === 'Cancelled' && booking.paymentStatus === 'Held' && user.role === 'customer') {
    const refund = await refundEscrow(id);
    if (!refund) return;
  }
  const updates: Record<string, unknown> = { status };
  if (status === 'Completed') updates.providerConfirmed = true;
  await db.update(bookings).set(updates).where(eq(bookings.id, id)); revalidatePath('/dashboard');
  redirect(dashPath(data, `tab=bookings&success=${encodeURIComponent(`Booking marked ${status.toLowerCase()}.`)}`));
}

export async function submitQuoteAction(data: FormData) {
  const user = await requireFormUser(data, 'provider'); blockDemo(user, data);
  const [provider] = await db.select().from(providers).where(eq(providers.userId, user.id)).limit(1); if (!provider) return;
  const requestId = val(data, 'requestId'), price = Number(val(data, 'price')), details = val(data, 'details');
  const [request] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, requestId)).limit(1);
  if (!request || request.status !== 'Open' || request.category !== provider.category || !price || price < 1 || !details) return;
  const [existing] = await db.select().from(quotes).where(and(eq(quotes.providerId, provider.id), eq(quotes.requestId, requestId))).limit(1);
  if (existing) await db.update(quotes).set({ price: String(price), details, duration: val(data, 'duration') }).where(eq(quotes.id, existing.id));
  else await db.insert(quotes).values({ requestId, providerId: provider.id, price: String(price), details, duration: val(data, 'duration') });
  revalidatePath('/dashboard');
}

export async function acceptQuoteAction(data: FormData) {
  const user = await requireFormUser(data, 'customer'); blockDemo(user, data); const id = val(data, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1); if (!quote) return;
  const [request] = await db.select().from(quoteRequests).where(and(eq(quoteRequests.id, quote.requestId), eq(quoteRequests.customerId, user.id))).limit(1);
  if (!request || request.status !== 'Open') return;
  const amount = Number(quote.price);
  const wallet = await getOrCreateWallet(user.id);
  if (Number(wallet.balance) < amount) error('/dashboard', `Not enough wallet balance for ${formatNaira(amount)}. Add funds to your wallet first.`);
  const accepted = await db.transaction(async tx => {
    const changed = await tx.update(quoteRequests).set({ status: 'Accepted' }).where(and(eq(quoteRequests.id, request.id), eq(quoteRequests.status, 'Open'))).returning({ id: quoteRequests.id });
    if (!changed.length) return false;
    await tx.update(quotes).set({ status: 'Accepted' }).where(eq(quotes.id, id));
    await tx.update(quotes).set({ status: 'Rejected' }).where(and(eq(quotes.requestId, request.id), ne(quotes.id, id)));
    const [booking] = await tx.insert(bookings).values({ customerId: user.id, providerId: quote.providerId, service: request.category, description: request.description, date: 'To be arranged', time: 'To be arranged', location: request.location, instructions: `Accepted quote: ₦${quote.price}. ${quote.details}`, status: 'Pending', price: String(amount) }).returning();
    return { bookingId: booking.id };
  });
  if (!accepted) return;
  const hold = await holdBookingEscrow(accepted.bookingId, user.id, amount);
  if (!hold.ok) {
    await db.delete(bookings).where(eq(bookings.id, accepted.bookingId));
    await db.update(quotes).set({ status: 'Submitted' }).where(eq(quotes.id, id));
    await db.update(quoteRequests).set({ status: 'Open' }).where(eq(quoteRequests.id, request.id));
    error('/dashboard', hold.reason || 'Unable to hold payment.');
  }
  revalidatePath('/dashboard');
  redirect(dashPath(data, 'tab=bookings&success=Quote%20accepted.%20Payment%20held%20in%20escrow.'));
}

export async function reviewAction(data: FormData) {
  const user = await requireFormUser(data, 'customer'); blockDemo(user, data); const bookingId = val(data, 'bookingId'), rating = Number(val(data, 'rating')), comment = val(data, 'comment');
  const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerId, user.id))).limit(1);
  if (!booking || booking.status !== 'Completed' || rating < 1 || rating > 5 || !comment) return;
  await db.insert(reviews).values({ bookingId, customerId: user.id, providerId: booking.providerId, rating, comment }).onConflictDoNothing();
  revalidatePath('/dashboard');
}

export async function supportAction(data: FormData) {
  const user = await getUser(); blockDemo(user);
  const name = val(data, 'name') || user?.name || '', email = val(data, 'email') || user?.email || '', subject = val(data, 'subject'), message = val(data, 'message');
  if (!name || !email.includes('@') || !subject || !message) error('/contact', 'Please complete all required fields.');
  await db.insert(supportRequests).values({ userId: user?.id, name, email, phone: val(data, 'phone'), subject, message });
  redirect('/contact?success=Message sent. Our team will review it.');
}

export async function updateProfileAction(data: FormData) {
  const user = await requireFormUser(data); blockDemo(user, data); const name = val(data, 'name'), location = val(data, 'location'), phone = val(data, 'phone');
  if (!name || !location || !phone) return;
  await db.update(users).set({ name, location, phone }).where(eq(users.id, user.id));
  if (user.role === 'provider') await db.update(providers).set({ name, location, area: val(data, 'area') || location, bio: val(data, 'bio') || '', experience: val(data, 'experience') || null, available: data.get('available') === 'on' }).where(eq(providers.userId, user.id));
  revalidatePath('/dashboard'); redirect('/dashboard?success=Profile updated');
}
