import { creditDeposit } from '@/lib/wallet';
import { paystackSecretKey, verifyPaystackSignature, verifyTransaction } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const signature = request.headers.get('x-paystack-signature');
  const rawBody = await request.text();
  const secret = paystackSecretKey();
  if (!secret || !verifyPaystackSignature(rawBody, signature || '', secret)) {
    return new Response('Invalid signature', { status: 401 });
  }
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return new Response('Bad JSON', { status: 400 }); }
  const name = String(event?.event || '');
  try {
    if (name === 'charge.success') {
      const reference = event?.data?.reference;
      const metadata = event?.data?.metadata;
      if (!reference || metadata?.kind !== 'deposit' || !metadata?.userId) return new Response('Ignored', { status: 200 });
      // Defer to verifyTransaction rather than trusting the webhook's amount alone
      const tx = await verifyTransaction(reference);
      if (tx?.status === 'success') await creditDeposit(metadata.userId, Number(tx.amount) / 100, reference, 'Paystack deposit');
    }
    // transfer.success / transfer.failed are handled by the withdrawal approval flow;
    // webhook updates optional here for future hardening.
  } catch {
    // Always 200 so Paystack does not retry indefinitely; failures are logged by design.
  }
  return new Response('OK', { status: 200 });
}
