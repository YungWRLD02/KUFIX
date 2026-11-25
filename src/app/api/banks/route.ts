import { isPaystackConfigured, listNigerianBanks } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

const FALLBACK_BANKS = [
  { code: '057', name: 'Zenith Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '044', name: 'First Bank of Nigeria' },
  { code: '033', name: 'UBA' },
  { code: '011', name: 'Access Bank' },
  { code: '215', name: 'Fidelity Bank' },
  { code: '023', name: 'Transcorp' },
  { code: '035', name: 'Polaris Bank' },
  { code: '108', name: 'Sterling Bank' },
  { code: '013', name: 'Union Bank of Nigeria' },
];

export async function GET() {
  if (!isPaystackConfigured()) return Response.json({ source: 'fallback', banks: FALLBACK_BANKS });
  try {
    const banks = await listNigerianBanks();
    return Response.json({ source: 'paystack', banks: banks.map(b => ({ code: b.code, name: b.name })) });
  } catch {
    return Response.json({ source: 'fallback', banks: FALLBACK_BANKS });
  }
}
