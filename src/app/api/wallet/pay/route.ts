import { getUser, getUserFromToken } from '@/lib/auth';
import { isPaystackConfigured, initializeDeposit, generateReference, PaystackError } from '@/lib/paystack';
import { getOrCreateWallet } from '@/lib/wallet';
import { isDemoUser } from '@/lib/demo';

export const dynamic = 'force-dynamic';

function redirectTo(path: string) {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const user = (await getUser()) || (await getUserFromToken(token));
  if (!user) return redirectTo('/login?error=Please%20sign%20in%20to%20deposit.');
  if (isDemoUser(user)) return redirectTo(`/dashboard?tab=wallet&notice=demo&t=${encodeURIComponent(token || '')}`);
  const amount = Number(url.searchParams.get('amount'));
  if (!amount || amount < 500 || amount > 10000000) return redirectTo(`/dashboard?tab=wallet&error=${encodeURIComponent('Enter a deposit of at least ₦500.')}`);
  if (!isPaystackConfigured()) {
    // Simulated mode: credit instantly (kept for local demo and offline use)
    const { creditDeposit } = await import('@/lib/wallet');
    await creditDeposit(user.id, amount, null, 'Simulated instant deposit (Paystack not configured)');
    return redirectTo(`/dashboard?tab=wallet&success=${encodeURIComponent(`Deposit of ₦${amount.toLocaleString('en-NG')} received (simulated).`)}&t=${encodeURIComponent(token || '')}`);
  }
  const reference = generateReference('dep');
  const callbackUrl = `${url.origin}/api/wallet/callback?t=${encodeURIComponent(token || '')}`;
  try {
    const { authorizationUrl } = await initializeDeposit({
      email: user.email,
      amountKobo: Math.round(amount * 100),
      reference,
      callbackUrl,
      metadata: { userId: user.id, kind: 'deposit' },
    });
    return Response.redirect(authorizationUrl, 303);
  } catch (error) {
    const message = error instanceof PaystackError ? error.message : 'Unable to start the payment. Please try again.';
    return redirectTo(`/dashboard?tab=wallet&error=${encodeURIComponent(message)}`);
  }
}
