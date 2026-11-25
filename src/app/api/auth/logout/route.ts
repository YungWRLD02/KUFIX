import { clearSession } from '@/lib/auth';
import { isSameOrigin } from '@/lib/request-security';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Invalid origin', { status: 403 });
  await clearSession();
  return new Response(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store' } });
}
