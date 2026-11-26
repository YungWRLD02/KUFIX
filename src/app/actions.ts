'use server';

import { db } from '@/db';
import {
  users,
  providers,
  bookings,
  quoteRequests,
  quotes,
  reviews,
  supportRequests,
  chatMessages,
} from '@/db/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  checkPassword,
  clearSession,
  getUser,
  hashPassword,
  requireFormUser,
  requireUser,
  setSession,
} from '@/lib/auth';
import {
  getOrCreateWallet,
  holdBookingEscrow,
  releaseEscrow,
  refundEscrow,
  formatNaira,
} from '@/lib/wallet';
import { getProvider } from '@/lib/marketplace';
import { findOrCreateProviderThread } from '@/lib/community';

const val = (data: FormData, key: string) => String(data.get(key) || '').trim();
const error = (path: string, message: string) =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
function formToken(data: FormData) {
  return String(data.get('t') || '');
}
function dashPath(data: FormData, query: string) {
  const t = formToken(data);
  return `/dashboard?${query}${t ? `&t=${encodeURIComponent(t)}` : ''}`;
}

export async function registerAction(data: FormData) {
  const name = val(data, 'name');
  const email = val(data, 'email').toLowerCase();
  const phone = val(data, 'phone');
  const password = val(data, 'password');
  const location = val(data, 'location') || 'Abuja';
  const role = val(data, 'role') === 'provider' ? 'provider' : 'customer';
  const path = `/signup?role=${role}`;

  if (!name || !email.includes('@') || !phone || password.length < 8) {
    error(path, 'Please complete all fields and use a password of at least 8 characters.');
  }
  if (role === 'provider' && (!val(data, 'category') || !val(data, 'bio'))) {
    error(path, 'Please add your service category and description.');
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${email}`)
    .limit(1);

  if (existing.length) {
    error(path, 'An account with this email already exists.');
  }

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      phone,
      passwordHash: hashPassword(password),
      role,
      location,
    })
    .returning();

  if (role === 'provider') {
    await db.insert(providers).values({
      userId: user.id,
      name,
      category: val(data, 'category'),
      location,
      area: location,
      bio: val(data, 'bio'),
      verification: 'Not verified',
    });
  }

  await setSession(user.id);
  redirect('/dashboard');
}

export async function loginAction(data: FormData) {
  const email = val(data, 'email').toLowerCase();
  const password = val(data, 'password');

  const [user] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${email}`)
    .limit(1);

  if (!user || user.isSuspended || !checkPassword(password, user.passwordHash)) {
    error('/login', 'Incorrect email or password.');
  }

  await setSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction() {
  await clearSession();
  redirect('/');
}

export async function bookingAction(data: FormData) {
  const user = await requireFormUser(data);
  if (user.role !== 'customer') {
    error('/dashboard', 'Please use a customer account to request a service quotation.');
  }
  const providerId = val(data, 'providerId');
  const provider = await getProvider(providerId);
  if (!provider) error('/professionals', 'Provider not found.');

  const service = val(data, 'service');
  const description = val(data, 'description');
  const date = val(data, 'date');
  const time = val(data, 'time');
  const location = val(data, 'location');
  const budget = val(data, 'budget') || val(data, 'price');

  if (!service || !description || !date || !time || !location) {
    error(`/professionals/${providerId}`, 'Please complete all required fields.');
  }

  // Option 2 Quote Request: Creates request and awaits provider quotation.
  const [created] = await db
    .insert(bookings)
    .values({
      customerId: user.id,
      providerId,
      service,
      description,
      date,
      time,
      location,
      instructions: val(data, 'instructions'),
      price: budget && Number(budget) >= 100 ? String(Number(budget)) : null,
      status: 'Pending',
      paymentStatus: 'Unpaid',
    })
    .returning();

  // Automatically start chat thread between customer and provider
  if (provider?.userId) {
    try {
      const thread = await findOrCreateProviderThread(
        user.id,
        providerId,
        `Quote Request · ${service}`
      );
      await db.insert(chatMessages).values({
        threadId: thread.id,
        senderId: user.id,
        body: `Hello! I have requested a quotation for ${service} in ${location} (${date} at ${time}). Description: "${description}". Looking forward to your quotation.`,
      });
    } catch {}
  }

  revalidatePath('/dashboard');
  redirect(
    dashPath(
      data,
      'tab=bookings&success=' +
        encodeURIComponent(
          'Quote request sent to professional! They will review your request and send a quotation.'
        )
    )
  );
}

export async function quoteRequestAction(data: FormData) {
  const user = await requireFormUser(data);
  if (user.role !== 'customer') {
    error('/dashboard', 'Please use a customer account to request a quote.');
  }
  const category = val(data, 'category');
  const description = val(data, 'description');
  const location = val(data, 'location');

  if (!category || !description || !location) {
    error('/request-quote', 'Please complete all required fields.');
  }

  await db
    .insert(quoteRequests)
    .values({ customerId: user.id, category, description, location });
  revalidatePath('/dashboard');
  redirect('/dashboard?success=Quote request posted');
}

export async function bookingStatusAction(data: FormData) {
  const user = await requireFormUser(data);
  const id = val(data, 'id');
  const status = val(data, 'status');

  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !['Accepted', 'Rejected', 'In Progress', 'Completed', 'Cancelled'].includes(status)
  ) {
    return;
  }

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return;

  if (user.role === 'provider') {
    const [provider] = await db
      .select()
      .from(providers)
      .where(and(eq(providers.id, booking.providerId), eq(providers.userId, user.id)))
      .limit(1);
    const allowed: Record<string, string[]> = {
      Pending: ['Accepted', 'Rejected'],
      Accepted: ['In Progress'],
      'In Progress': ['Completed'],
    };
    if (!provider || !allowed[booking.status]?.includes(status)) return;
  } else if (user.role === 'customer') {
    if (
      booking.customerId !== user.id ||
      !(
        (status === 'Cancelled' &&
          ['Pending', 'Accepted', 'Rescheduled', 'In Progress'].includes(booking.status)) ||
        (status === 'Accepted' && booking.status === 'Rescheduled')
      )
    ) {
      return;
    }
  } else if (user.role !== 'admin') {
    return;
  }

  if (status === 'Rejected' && booking.paymentStatus === 'Held') {
    const refund = await refundEscrow(id);
    if (!refund) return;
  }
  if (status === 'Cancelled' && booking.paymentStatus === 'Held' && user.role === 'customer') {
    const refund = await refundEscrow(id);
    if (!refund) return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === 'Accepted' && user.role === 'provider') {
    const quotePrice = val(data, 'price');
    if (quotePrice && Number(quotePrice) >= 100) {
      updates.price = String(Number(quotePrice));
    }
  }
  if (status === 'Completed') {
    updates.providerConfirmed = true;
  }

  await db.update(bookings).set(updates).where(eq(bookings.id, id));
  revalidatePath('/dashboard');
  redirect(
    dashPath(
      data,
      `tab=bookings&success=${encodeURIComponent(`Booking marked ${status.toLowerCase()}.`)}`
    )
  );
}

export async function submitQuoteAction(data: FormData) {
  const user = await requireFormUser(data, 'provider');
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.userId, user.id))
    .limit(1);
  if (!provider) return;

  const requestId = val(data, 'requestId');
  const price = Number(val(data, 'price'));
  const details = val(data, 'details');
  const [request] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, requestId))
    .limit(1);

  if (
    !request ||
    request.status !== 'Open' ||
    request.category !== provider.category ||
    !price ||
    price < 1 ||
    !details
  ) {
    return;
  }

  const [existing] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.providerId, provider.id), eq(quotes.requestId, requestId)))
    .limit(1);

  if (existing) {
    await db
      .update(quotes)
      .set({ price: String(price), details, duration: val(data, 'duration') })
      .where(eq(quotes.id, existing.id));
  } else {
    await db.insert(quotes).values({
      requestId,
      providerId: provider.id,
      price: String(price),
      details,
      duration: val(data, 'duration'),
    });
  }
  revalidatePath('/dashboard');
}

export async function acceptQuoteAction(data: FormData) {
  const user = await requireFormUser(data, 'customer');
  const id = val(data, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return;

  const [request] = await db
    .select()
    .from(quoteRequests)
    .where(and(eq(quoteRequests.id, quote.requestId), eq(quoteRequests.customerId, user.id)))
    .limit(1);
  if (!request || request.status !== 'Open') return;

  const amount = Number(quote.price);
  const wallet = await getOrCreateWallet(user.id);
  if (Number(wallet.balance) < amount) {
    error(
      '/dashboard',
      `Not enough wallet balance for ${formatNaira(amount)}. Add funds to your wallet first.`
    );
  }

  const accepted = await db.transaction(async (tx) => {
    const changed = await tx
      .update(quoteRequests)
      .set({ status: 'Accepted' })
      .where(and(eq(quoteRequests.id, request.id), eq(quoteRequests.status, 'Open')))
      .returning({ id: quoteRequests.id });

    if (!changed.length) return false;
    await tx.update(quotes).set({ status: 'Accepted' }).where(eq(quotes.id, id));
    await tx
      .update(quotes)
      .set({ status: 'Rejected' })
      .where(and(eq(quotes.requestId, request.id), ne(quotes.id, id)));

    const [booking] = await tx
      .insert(bookings)
      .values({
        customerId: user.id,
        providerId: quote.providerId,
        service: request.category,
        description: request.description,
        date: 'To be arranged',
        time: 'To be arranged',
        location: request.location,
        instructions: `Accepted quote: ₦${quote.price}. ${quote.details}`,
        status: 'Pending',
        price: String(amount),
      })
      .returning();

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
  redirect(
    dashPath(data, 'tab=bookings&success=Quote%20accepted.%20Payment%20held%20in%20escrow.')
  );
}

export async function reviewAction(data: FormData) {
  const user = await requireFormUser(data, 'customer');
  const bookingId = val(data, 'bookingId');
  const rating = Number(val(data, 'rating'));
  const comment = val(data, 'comment');

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, user.id)))
    .limit(1);

  if (!booking || booking.status !== 'Completed' || rating < 1 || rating > 5 || !comment) {
    return;
  }

  await db
    .insert(reviews)
    .values({
      bookingId,
      customerId: user.id,
      providerId: booking.providerId,
      rating,
      comment,
    })
    .onConflictDoNothing();

  revalidatePath('/dashboard');
}

export async function supportAction(data: FormData) {
  const user = await getUser();
  const name = val(data, 'name') || user?.name || '';
  const email = val(data, 'email') || user?.email || '';
  const subject = val(data, 'subject');
  const message = val(data, 'message');

  if (!name || !email.includes('@') || !subject || !message) {
    error('/contact', 'Please complete all required fields.');
  }

  await db.insert(supportRequests).values({
    userId: user?.id,
    name,
    email,
    phone: val(data, 'phone'),
    subject,
    message,
  });
  redirect('/contact?success=Message sent. Our team will review it.');
}

export async function updateProfileAction(data: FormData) {
  const user = await requireFormUser(data);
  const name = val(data, 'name');
  const location = val(data, 'location');
  const phone = val(data, 'phone');

  if (!name || !location || !phone) return;

  await db.update(users).set({ name, location, phone }).where(eq(users.id, user.id));

  if (user.role === 'provider') {
    await db
      .update(providers)
      .set({
        name,
        location,
        area: val(data, 'area') || location,
        bio: val(data, 'bio') || '',
        experience: val(data, 'experience') || null,
        available: data.get('available') === 'on',
      })
      .where(eq(providers.userId, user.id));
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?success=Profile updated');
}
