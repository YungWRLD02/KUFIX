import { parseSessionToken, setSession } from '@/lib/auth';
import { isSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const token = request.headers.get('content-type')?.includes('application/json')
    ? String(((await request.json().catch(() => ({}))) as { token?: string }).token || '')
    : String((await request.formData()).get('t') || '');
  const id = parseSessionToken(token);
  if (!id) return Response.json({ ok: false }, { status: 401 });
  await setSession(id);
  return Response.json({ ok: true });
}
