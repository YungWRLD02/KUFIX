import { db } from '@/db';
import { wallets, walletTransactions, bookings, providers, users, bankAccounts } from '@/db/schema';
import { isPaystackConfigured, resolveAccountNumber, listNigerianBanks, createTransferRecipient, initiateTransfer, generateReference, verifyTransfer } from '@/lib/paystack';
import { and, desc, eq } from 'drizzle-orm';

export type WalletTx = typeof walletTransactions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletType = Wallet;

export function formatNaira(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export async function getOrCreateWallet(userId: string) {
  const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(wallets).values({ userId, balance: '0' }).onConflictDoNothing({ target: wallets.userId });
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return wallet;
}

export async function walletTransactionsFor(userId: string, limit = 20) {
  return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(limit);
}

/** Credit a wallet deposit. */
export async function depositToWallet(userId: string, amount: number, note = 'Direct deposit') {
  return creditDeposit(userId, amount, null, note);
}

/**
 * Actually credit a deposit. Idempotent per external reference:
 * the same Paystack reference can only credit once.
 */
export async function creditDeposit(userId: string, amount: number, externalReference: string | null, note: string) {
  if (externalReference) {
    const [existing] = await db.select().from(walletTransactions).where(and(eq(walletTransactions.userId, userId), eq(walletTransactions.externalReference, externalReference))).limit(1);
    if (existing) return false; // already credited
  }
  const wallet = await getOrCreateWallet(userId);
  await db.transaction(async tx => {
    await tx.update(wallets).set({ balance: String(Number(wallet.balance) + amount), updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    await tx.insert(walletTransactions).values({ userId, type: 'deposit', amount: String(amount), status: 'completed', note, externalReference: externalReference || undefined });
  });
  return true;
}

/** Hold a booking amount in escrow: customer balance down, entry recorded. */
export async function holdBookingEscrow(bookingId: string, customerId: string, amount: number) {
  const wallet = await getOrCreateWallet(customerId);
  const balance = Number(wallet.balance);
  if (balance < amount) return { ok: false, reason: 'Insufficient wallet balance. Deposit first.' };
  await db.transaction(async tx => {
    // guard against double-paying for the same booking
    const [current] = await tx.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.customerId, customerId))).limit(1);
    if (!current || current.paymentStatus !== 'Unpaid') return { ok: false, reason: 'This booking has already been paid.' };
    await tx.update(wallets).set({ balance: String(balance - amount), updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    await tx.update(bookings).set({ paymentStatus: 'Held', escrowHeldAt: new Date() }).where(eq(bookings.id, bookingId));
    await tx.insert(walletTransactions).values({ userId: customerId, type: 'escrow_hold', amount: String(amount), status: 'completed', bookingId, note: 'Escrow hold for a booking' });
  });
  return { ok: true };
}

/** Release escrowed funds to the provider after both parties confirm the work. */
export async function releaseEscrow(bookingId: string) {
  return db.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking || booking.paymentStatus !== 'Held' || !booking.price) return null;
    const amount = Number(booking.price);
    const [provider] = await tx.select().from(providers).where(eq(providers.id, booking.providerId)).limit(1);
    if (!provider?.userId) return null;
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, provider.userId)).limit(1);
    await tx.insert(wallets).values({ userId: provider.userId, balance: String((wallet ? Number(wallet.balance) : 0) + amount) }).onConflictDoNothing({ target: wallets.userId });
    await tx.update(wallets).set({ balance: String((wallet ? Number(wallet.balance) : 0) + amount), updatedAt: new Date() }).where(eq(wallets.userId, provider.userId));
    await tx.insert(walletTransactions).values({ userId: provider.userId, type: 'escrow_release', amount: String(amount), status: 'completed', bookingId, note: `Payment for: ${booking.service}` });
    await tx.update(bookings).set({ paymentStatus: 'Released', providerConfirmed: true, customerConfirmed: true }).where(eq(bookings.id, bookingId));
    return booking;
  });
}

/** Refund escrowed funds to the customer. */
export async function refundEscrow(bookingId: string) {
  return db.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking || booking.paymentStatus !== 'Held' || !booking.price) return null;
    const amount = Number(booking.price);
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, booking.customerId)).limit(1);
    await tx.insert(wallets).values({ userId: booking.customerId, balance: String((wallet ? Number(wallet.balance) : 0) + amount) }).onConflictDoNothing({ target: wallets.userId });
    await tx.update(wallets).set({ balance: String((wallet ? Number(wallet.balance) : 0) + amount), updatedAt: new Date() }).where(eq(wallets.userId, booking.customerId));
    await tx.insert(walletTransactions).values({ userId: booking.customerId, type: 'refund', amount: String(amount), status: 'completed', bookingId, note: `Refund for: ${booking.service}` });
    await tx.update(bookings).set({ paymentStatus: 'Refunded' }).where(eq(bookings.id, bookingId));
    return booking;
  });
}

export async function pendingWithdrawalsFor() {
  const rows = await db.select().from(walletTransactions).where(and(eq(walletTransactions.type, 'withdrawal'), eq(walletTransactions.status, 'pending'))).orderBy(desc(walletTransactions.createdAt));
  const userIds = [...new Set(rows.map(r => r.userId))];
  if (!userIds.length) return [];
  const rows_users = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  return rows.map(row => ({ transaction: row, user: rows_users.find(u => u.id === row.userId) }));
}

export async function createWithdrawalRequest(userId: string, amount: number, note: string, bank?: { bankName: string; accountNumber: string }) {
  const wallet = await getOrCreateWallet(userId);
  const balance = Number(wallet.balance);
  if (amount < 1000) return { ok: false, reason: 'Minimum withdrawal is ₦1,000.' };
  if (amount > balance) return { ok: false, reason: 'Withdrawal exceeds your available wallet balance.' };
  // resolve bank code when Paystack is configured
  let bankCode = '';
  if (isPaystackConfigured() && bank?.bankName) {
    try {
      const banks = await listNigerianBanks();
      const match = banks.find(b => b.name.toLowerCase() === bank.bankName.trim().toLowerCase());
      if (!match) return { ok: false, reason: 'Bank not recognised by Paystack. Use the exact name shown on your statement.' };
      bankCode = match.code;
    } catch {
      return { ok: false, reason: 'Could not load the bank list from Paystack. Please try again.' };
    }
  }
  await db.transaction(async tx => {
    await tx.update(wallets).set({ balance: String(balance - amount), updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    await tx.insert(walletTransactions).values({ userId, type: 'withdrawal', amount: String(amount), status: 'pending', note });
    if (bank) {
      const [existing] = await tx.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)).limit(1);
      if (existing) {
        await tx.update(bankAccounts).set({ bankName: bank.bankName, accountNumber: bank.accountNumber, bankCode: bankCode || existing.bankCode, updatedAt: new Date() }).where(eq(bankAccounts.id, existing.id));
      } else {
        await tx.insert(bankAccounts).values({ userId, bankName: bank.bankName, accountNumber: bank.accountNumber, bankCode });
      }
    }
  });
  return { ok: true };
}

/** Approve a withdrawal. In Paystack mode this funds a real payout (pending finalisation); otherwise it processes locally. */
export async function approveWithdrawal(transactionId: string): Promise<{ ok: boolean; message: string }> {
  const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.id, transactionId)).limit(1);
  if (!tx || tx.type !== 'withdrawal' || tx.status !== 'pending') return { ok: false, message: 'Withdrawal could not be approved.' };
  if (!isPaystackConfigured()) {
    await db.update(walletTransactions).set({ status: 'approved' }).where(eq(walletTransactions.id, transactionId));
    return { ok: true, message: 'Withdrawal approved. Funds released.' };
  }
  const [bank] = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, tx.userId)).limit(1);
  if (!bank || !bank.bankCode) return { ok: false, message: 'No bank account on file for this user. Ask them to add bank details and retry.' };
  // Validate the account with Paystack before paying out
  try {
    const resolved = await resolveAccountNumber(bank.accountNumber, bank.bankCode);
    if (!resolved || !('account_name' in (resolved as any)) || !(resolved as any).account_name) {
      return { ok: false, message: 'Could not verify the bank account — the account number or bank code may be wrong.' };
    }
  } catch {
    return { ok: false, message: 'Bank account could not be verified with Paystack. Fix the account details and retry.' };
  }
  try {
    let recipientCode = bank.paystackRecipientCode;
    if (!recipientCode) {
      const [accountOwner] = await db.select({ name: users.name }).from(users).where(eq(users.id, tx.userId)).limit(1);
      recipientCode = await createTransferRecipient({ name: accountOwner?.name || 'KUFIX user', accountNumber: bank.accountNumber, bankCode: bank.bankCode, description: 'KUFIX withdrawal' });
      await db.update(bankAccounts).set({ paystackRecipientCode: recipientCode }).where(eq(bankAccounts.id, bank.id));
    }
    const reference = generateReference('withdraw');
    const transfer = await initiateTransfer({ recipientCode, amountKobo: Math.round(Number(tx.amount) * 100), reference, reason: 'KUFIX wallet withdrawal' });
    await db.update(walletTransactions).set({ status: 'sending', externalReference: reference, note: (tx.note || '') + ` · Sending to ${bank.bankName} ${bank.accountNumber}` }).where(eq(walletTransactions.id, transactionId));
    if (transfer?.status === 'otp' || transfer?.status === 'pending') {
      // Needs OTP finalisation in Paystack — leave as sending until the webhook confirms
    } else if (transfer?.status === 'success') {
      await db.update(walletTransactions).set({ status: 'approved' }).where(eq(walletTransactions.id, transactionId));
    } else {
      await db.update(walletTransactions).set({ status: 'failed' }).where(eq(walletTransactions.id, transactionId));
      // restore funds
      const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, tx.userId)).limit(1);
      if (wallet) await db.update(wallets).set({ balance: String(Number(wallet.balance) + Number(tx.amount)), updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
      return { ok: false, message: 'Paystack could not initiate the payout. Funds were restored to the user.' };
    }
    return { ok: true, message: 'Withdrawal initiated — funds are on the way. You will be notified when the payout completes.' };
  } catch (error) {
    await db.update(walletTransactions).set({ status: 'failed' }).where(eq(walletTransactions.id, transactionId));
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, tx.userId)).limit(1);
    if (wallet) await db.update(wallets).set({ balance: String(Number(wallet.balance) + Number(tx.amount)), updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    return { ok: false, message: error instanceof Error ? error.message : 'Paystack could not process the payout. Funds were restored.' };
  }
}

export async function rejectWithdrawal(transactionId: string) {
  const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.id, transactionId)).limit(1);
  if (!tx || tx.type !== 'withdrawal' || tx.status !== 'pending') return false;
  await db.transaction(async (inner: any) => {
    await inner.update(walletTransactions).set({ status: 'rejected' }).where(eq(walletTransactions.id, transactionId));
    const [wallet] = await inner.select().from(wallets).where(eq(wallets.userId, tx.userId)).limit(1);
    if (wallet) await inner.update(wallets).set({ balance: String(Number(wallet.balance) + Number(tx.amount)), updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
  });
  return true;
}

export async function activeEscrowsFor(role: string, userId: string, providerId?: string | null) {
  const rows = await db.select().from(bookings).where(and(eq(bookings.paymentStatus, 'Held'))).orderBy(desc(bookings.createdAt));
  if (role === 'provider') return providerId ? rows.filter(b => b.providerId === providerId) : [];
  if (role === 'customer') return rows.filter(b => b.customerId === userId);
  return rows;
}
