import { getUser, getUserFromToken } from '@/lib/auth';
import { isPaystackConfigured, verifyTransaction, PaystackError } from '@/lib/paystack';
import { creditDeposit } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

function redirectTo(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference');
  const token = url.searchParams.get('t');
  const user = (await getUser()) || (await getUserFromToken(token));

  if (!user || !reference) {
    return redirectTo(
      '/dashboard?tab=wallet&error=' + encodeURIComponent('Payment could not be verified.')
    );
  }
  if (!isPaystackConfigured()) {
    return redirectTo(
      '/dashboard?tab=wallet&error=' + encodeURIComponent('Paystack is not configured.')
    );
  }

  const dashboardUrl = (query: string) =>
    `/dashboard?tab=wallet&t=${encodeURIComponent(token || '')}&${query}`;

  try {
    const tx = await verifyTransaction(reference);
    if (
      !tx ||
      tx.status !== 'success' ||
      tx.metadata?.kind !== 'deposit' ||
      tx.metadata?.userId !== user.id
    ) {
      return redirectTo(
        dashboardUrl(
          'error=' + encodeURIComponent('Payment was not completed or could not be matched.')
        )
      );
    }
    const amount = Number(tx.amount) / 100;
    await creditDeposit(user.id, amount, reference, 'Paystack deposit');
    return redirectTo(
      dashboardUrl(
        'success=' +
          encodeURIComponent(`Deposit of ₦${amount.toLocaleString('en-NG')} received.`)
      )
    );
  } catch (error) {
    const message =
      error instanceof PaystackError ? error.message : 'Payment verification failed.';
    return redirectTo(dashboardUrl('error=' + encodeURIComponent(message)));
  }
}
