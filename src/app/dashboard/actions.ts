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
  serviceCategories,
  walletTransactions,
  verificationDocuments,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, hashPassword, requireFormUser } from '@/lib/auth';
import { getCategories } from '@/lib/marketplace';
import {
  depositToWallet,
  createWithdrawalRequest,
  approveWithdrawal,
  rejectWithdrawal,
  releaseEscrow,
  formatNaira,
  getOrCreateWallet,
  holdBookingEscrow,
} from '@/lib/wallet';
import {
  validateDocumentFile,
  storeDocument,
  latestLevelFor,
  DOCUMENT_TYPES,
} from '@/lib/verification';
import { savePublicUpload } from '@/lib/upload';

const val = (data: FormData, key: string) => String(data.get(key) || '').trim();
const validId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function tokenFrom(data: FormData) {
  return String(data.get('t') || '');
}
function done(
  data: FormData,
  tab: string,
  message: string,
  kind: 'success' | 'error' = 'success'
): never {
  revalidatePath('/dashboard');
  const t = tokenFrom(data);
  redirect(
    `/dashboard?tab=${tab}${t ? `&t=${encodeURIComponent(t)}` : ''}&${kind}=${encodeURIComponent(
      message
    )}`
  );
}

export async function saveProfileAction(data: FormData) {
  const user = await requireFormUser(data);
  const name = val(data, 'name');
  const email = val(data, 'email').toLowerCase();
  const phone = val(data, 'phone');
  const location = val(data, 'location');

  if (
    !name ||
    name.length > 180 ||
    !email.includes('@') ||
    email.length > 255 ||
    !phone ||
    phone.length > 30 ||
    !location ||
    location.length > 180
  ) {
    done(data, 'settings', 'Please provide valid profile details.', 'error');
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing && existing.id !== user.id) {
    done(data, 'settings', 'This email is already in use.', 'error');
  }

  const category = val(data, 'category');
  const categories = await getCategories();
  const [existingProvider] =
    user.role === 'provider'
      ? await db.select().from(providers).where(eq(providers.userId, user.id)).limit(1)
      : [];

  if (
    user.role === 'provider' &&
    !categories.some((c) => c.name === category) &&
    existingProvider?.category !== category
  ) {
    done(data, 'settings', 'Please select a valid service category.', 'error');
  }

  await db.update(users).set({ name, email, phone, location }).where(eq(users.id, user.id));

  if (user.role === 'provider') {
    const servicesOffered = data
      .getAll('servicesOffered')
      .map(String)
      .filter((c) => c && c !== category)
      .slice(0, 12);

    let avatarUrl: string | undefined = undefined;
    const avatarFile = data.get('avatarFile') as File | null;
    if (avatarFile && avatarFile.size > 0) {
      const up = await savePublicUpload(avatarFile, 'avatars');
      if (up.url) avatarUrl = up.url;
    }

    const profile: Record<string, unknown> = {
      name,
      location,
      category,
      area: val(data, 'area') || location,
      bio: val(data, 'bio'),
      experience: val(data, 'experience') || null,
      available: data.get('available') === 'on',
      servicesOffered: servicesOffered.join(', '),
    };
    if (avatarUrl) {
      profile.avatar = avatarUrl;
    }

    if (existingProvider) {
      await db.update(providers).set(profile).where(eq(providers.userId, user.id));
    } else {
      await db.insert(providers).values({ ...(profile as any), userId: user.id });
    }
  }
  done(data, 'settings', 'Your profile has been updated.');
}

export async function changePasswordAction(data: FormData) {
  const user = await requireFormUser(data);
  const current = val(data, 'currentPassword');
  const password = val(data, 'newPassword');
  const confirm = val(data, 'confirmPassword');

  if (!checkPassword(current, user.passwordHash)) {
    done(data, 'settings', 'Your current password is incorrect.', 'error');
  }
  if (password.length < 8 || password.length > 512 || password !== confirm) {
    done(
      data,
      'settings',
      'New passwords must match and contain at least 8 characters.',
      'error'
    );
  }
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, user.id));
  done(data, 'settings', 'Your password has been changed.');
}

export async function rescheduleAction(data: FormData) {
  const user = await requireFormUser(data, 'provider');
  const id = val(data, 'id');
  const date = val(data, 'date');
  const time = val(data, 'time');

  if (!validId(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    done(data, 'bookings', 'Please provide a valid date and time.', 'error');
  }
  const [provider] = await db.select().from(providers).where(eq(providers.userId, user.id)).limit(1);
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (
    !provider ||
    !booking ||
    booking.providerId !== provider.id ||
    !['Pending', 'Accepted', 'Rescheduled'].includes(booking.status)
  ) {
    done(data, 'bookings', 'This request cannot be rescheduled.', 'error');
  }
  await db.update(bookings).set({ date, time, status: 'Rescheduled' }).where(eq(bookings.id, id));
  done(data, 'bookings', 'A new date and time has been suggested.');
}

export async function cancelQuoteRequestAction(data: FormData) {
  const user = await requireFormUser(data, 'customer');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'quotes', 'Request not found.', 'error');
  const [request] = await db
    .select()
    .from(quoteRequests)
    .where(and(eq(quoteRequests.id, id), eq(quoteRequests.customerId, user.id)))
    .limit(1);
  if (!request || request.status !== 'Open') {
    done(data, 'quotes', 'Only open requests can be cancelled.', 'error');
  }
  await db.update(quoteRequests).set({ status: 'Cancelled' }).where(eq(quoteRequests.id, id));
  done(data, 'quotes', 'Quote request cancelled.');
}

export async function dashboardSupportAction(data: FormData) {
  const user = await requireFormUser(data);
  const subject = val(data, 'subject');
  const message = val(data, 'message');
  if (!subject || subject.length > 180 || !message) {
    done(data, 'support', 'Please provide a subject and message.', 'error');
  }
  await db.insert(supportRequests).values({
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    subject,
    message,
  });
  done(data, 'support', 'Your support request has been submitted.');
}

export async function adminUserStatusAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  const suspend = val(data, 'suspend') === 'true';
  if (!validId(id) || id === user.id) {
    done(data, 'users', 'You cannot change this account.', 'error');
  }
  await db.update(users).set({ isSuspended: suspend }).where(eq(users.id, id));
  done(data, 'users', suspend ? 'Account suspended.' : 'Account reactivated.');
}

export async function adminVerificationAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  const status = val(data, 'verification');
  const allowed = [
    'Not verified',
    'Phone verified',
    'Identity checked',
    'Business/profile reviewed',
    'Professional credentials checked',
  ];
  if (
    !validId(id) ||
    !allowed.includes(status) ||
    (status !== 'Not verified' && data.get('confirmed') !== 'on')
  ) {
    done(data, 'verification', 'Confirm the check before changing the verification label.', 'error');
  }
  const [provider] = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
  if (!provider) done(data, 'verification', 'Provider not found.', 'error');
  await db.update(providers).set({ verification: status }).where(eq(providers.id, id));
  revalidatePath('/professionals');
  done(data, 'verification', 'Verification label updated.');
}

export async function adminReviewAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'reviews', 'Review not found.', 'error');
  await db.update(reviews).set({ hidden: val(data, 'hidden') === 'true' }).where(eq(reviews.id, id));
  revalidatePath('/professionals');
  done(data, 'reviews', 'Review visibility updated.');
}

export async function adminSupportAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  const status = val(data, 'status');
  const response = val(data, 'response');
  if (!validId(id) || !['Open', 'In Progress', 'Resolved'].includes(status)) {
    done(data, 'support', 'Invalid support update.', 'error');
  }
  await db
    .update(supportRequests)
    .set({ status, response: response || null })
    .where(eq(supportRequests.id, id));
  done(data, 'support', 'Support request updated.');
}

function refreshCatalogue() {
  for (const path of ['/', '/services', '/professionals', '/signup', '/request-quote']) {
    revalidatePath(path);
  }
}

export async function createCategoryAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const name = val(data, 'name');
  const description = val(data, 'description');
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  if (!name || name.length > 100 || !description || description.length > 255 || !slug) {
    done(data, 'categories', 'Provide a valid category name and description.', 'error');
  }
  try {
    await db.insert(serviceCategories).values({ name, slug, description, icon: 'Wrench', tone: 'mint' });
  } catch {
    done(data, 'categories', 'A category with that name already exists.', 'error');
  }
  refreshCatalogue();
  done(data, 'categories', 'Service category added.');
}

export async function updateCategoryAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  const name = val(data, 'name');
  const description = val(data, 'description');
  if (!validId(id) || !name || name.length > 100 || !description || description.length > 255) {
    done(data, 'categories', 'Provide a valid name and description.', 'error');
  }
  const [old] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id)).limit(1);
  if (!old) done(data, 'categories', 'Category not found.', 'error');
  try {
    await db.transaction(async (tx) => {
      await tx.update(serviceCategories).set({ name, description }).where(eq(serviceCategories.id, id));
      if (old.name !== name) {
        await tx.update(providers).set({ category: name }).where(eq(providers.category, old.name));
        await tx.update(quoteRequests).set({ category: name }).where(eq(quoteRequests.category, old.name));
      }
    });
  } catch {
    done(data, 'categories', 'A category with that name already exists.', 'error');
  }
  refreshCatalogue();
  done(data, 'categories', 'Service category updated.');
}

export async function toggleCategoryAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'categories', 'Category not found.', 'error');
  await db
    .update(serviceCategories)
    .set({ isActive: val(data, 'active') === 'true' })
    .where(eq(serviceCategories.id, id));
  refreshCatalogue();
  done(data, 'categories', 'Service category status updated.');
}

export async function payEscrowAction(data: FormData) {
  const user = await requireFormUser(data, 'customer');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'bookings', 'Booking not found.', 'error');
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.customerId, user.id)))
    .limit(1);
  if (!booking) done(data, 'bookings', 'Booking not found.', 'error');
  if (booking.paymentStatus === 'Held') {
    done(data, 'bookings', 'Payment for this booking is already held in escrow.');
  }
  const amount = Number(booking.price);
  if (!amount || amount < 100) {
    done(
      data,
      'bookings',
      'The quotation price is not set yet. Please wait for the provider to submit a quotation.',
      'error'
    );
  }
  const wallet = await getOrCreateWallet(user.id);
  if (Number(wallet.balance) < amount) {
    done(
      data,
      'wallet',
      `You need ${formatNaira(amount)} in your wallet to fund escrow for this quotation. Please add funds below.`,
      'error'
    );
  }
  const hold = await holdBookingEscrow(id, user.id, amount);
  if (!hold.ok) done(data, 'bookings', hold.reason || 'Unable to hold payment in escrow.', 'error');
  done(
    data,
    'bookings',
    `Payment of ${formatNaira(amount)} held securely in escrow. The provider can now start work.`
  );
}

export async function disputeBookingAction(data: FormData) {
  const user = await requireFormUser(data, 'customer');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'bookings', 'Booking not found.', 'error');
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.customerId, user.id)))
    .limit(1);
  if (!booking) done(data, 'bookings', 'Booking not found.', 'error');
  await db.update(bookings).set({ status: 'Disputed' }).where(eq(bookings.id, id));
  done(
    data,
    'bookings',
    'Dispute opened. Our customer care and administration team will review and resolve it.',
    'success'
  );
}

export async function confirmDoneAction(data: FormData) {
  const user = await requireFormUser(data, 'customer');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'bookings', 'Booking not found.', 'error');
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.customerId, user.id)))
    .limit(1);
  if (!booking || booking.status !== 'Completed') {
    done(data, 'bookings', 'This booking is not complete yet.', 'error');
  }
  if (!booking.providerConfirmed) {
    done(data, 'bookings', 'Waiting for the provider to confirm the work is complete.', 'error');
  }
  if (booking.customerConfirmed) {
    done(data, 'bookings', 'You have already confirmed this booking.');
  }
  await db.update(bookings).set({ customerConfirmed: true }).where(eq(bookings.id, id));
  if (booking.paymentStatus === 'Held' && Number(booking.price) > 0) {
    await releaseEscrow(id);
  }
  done(data, 'bookings', 'Job confirmed. Funds have been released to the provider.');
}

export async function depositWalletAction(data: FormData) {
  const user = await requireFormUser(data);
  const custom = val(data, 'customAmount');
  const amount = custom ? Number(custom) : Number(val(data, 'amount'));
  if (!amount || amount < 500 || amount > 10000000) {
    done(data, 'wallet', 'Enter a deposit of at least ₦500.', 'error');
  }
  redirect(`/api/wallet/pay?amount=${amount}&t=${encodeURIComponent(val(data, 't'))}`);
}

export async function withdrawalAction(data: FormData) {
  const user = await requireFormUser(data);
  const amount = Number(val(data, 'amount'));
  const bankName = val(data, 'bankName');
  const accountNumber = val(data, 'accountNumber');
  if (!amount || amount < 1000) done(data, 'wallet', 'Minimum withdrawal is ₦1,000.', 'error');
  if (!bankName || !accountNumber) {
    done(data, 'wallet', 'Enter your bank name and account number.', 'error');
  }
  const note = `Bank: ${bankName} · Acc: ${accountNumber}`;
  const result = await createWithdrawalRequest(user.id, amount, note, { bankName, accountNumber });
  if (!result.ok) done(data, 'wallet', result.reason || 'Unable to request withdrawal.', 'error');
  done(data, 'wallet', 'Withdrawal request submitted. It will be processed once approved.');
}

export async function approveWithdrawalAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'wallet', 'Withdrawal not found.', 'error');
  const result = await approveWithdrawal(id);
  done(data, 'wallet', result.message, result.ok ? 'success' : 'error');
}

export async function rejectWithdrawalAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'wallet', 'Withdrawal not found.', 'error');
  const ok = await rejectWithdrawal(id);
  done(
    data,
    'wallet',
    ok ? 'Withdrawal rejected; funds restored.' : 'Withdrawal could not be rejected.',
    ok ? 'success' : 'error'
  );
}

export async function uploadVerificationDocumentAction(data: FormData) {
  const user = await requireFormUser(data, 'provider');
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.userId, user.id))
    .limit(1);
  if (!provider) done(data, 'verification', 'Complete your provider profile first.', 'error');

  const file = data.get('document');
  const documentType = val(data, 'documentType');
  if (!(file instanceof File) || file.size === 0) {
    done(data, 'verification', 'Choose a document to upload.', 'error');
  }
  const sizeError = validateDocumentFile(file.name || '', file.size, file.type);
  if (sizeError) done(data, 'verification', sizeError, 'error');

  const buffer = Buffer.from(await file.arrayBuffer());
  await storeDocument(
    provider!.id,
    documentType,
    file.name || 'document',
    buffer,
    file.type || 'application/octet-stream'
  );
  done(
    data,
    'verification',
    `Document uploaded (${
      DOCUMENT_TYPES.find((d) => d.type === documentType)?.label || 'document'
    }). Waiting for admin review.`
  );
}

export async function approveVerificationDocumentAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'verification', 'Document not found.', 'error');

  const [doc] = await db
    .select()
    .from(verificationDocuments)
    .where(eq(verificationDocuments.id, id))
    .limit(1);
  if (!doc) done(data, 'verification', 'Document not found.', 'error');

  await db
    .update(verificationDocuments)
    .set({
      status: 'approved',
      reviewedById: user.id,
      reviewedAt: new Date(),
      adminNote: val(data, 'note') || null,
    })
    .where(eq(verificationDocuments.id, id));

  const newLevel = await latestLevelFor(doc.providerId);
  if (newLevel) {
    await db.update(providers).set({ verification: newLevel }).where(eq(providers.id, doc.providerId));
  }
  revalidatePath('/professionals');
  done(data, 'verification', 'Document approved and verification label updated.');
}

export async function rejectVerificationDocumentAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'verification', 'Document not found.', 'error');

  await db
    .update(verificationDocuments)
    .set({
      status: 'rejected',
      reviewedById: user.id,
      reviewedAt: new Date(),
      adminNote: val(data, 'note') || null,
    })
    .where(eq(verificationDocuments.id, id));
  revalidatePath('/professionals');
  done(data, 'verification', 'Document rejected.');
}

export async function requestMoreInfoVerificationAction(data: FormData) {
  const user = await requireFormUser(data, 'admin');
  const id = val(data, 'id');
  if (!validId(id)) done(data, 'verification', 'Document not found.', 'error');

  await db
    .update(verificationDocuments)
    .set({
      status: 'needs_info',
      reviewedById: user.id,
      reviewedAt: new Date(),
      adminNote: val(data, 'note') || 'Please provide additional information.',
    })
    .where(eq(verificationDocuments.id, id));
  done(data, 'verification', 'Requested more information from the provider.');
}
