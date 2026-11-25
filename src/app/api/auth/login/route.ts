import { db } from '@/db';
import { users } from '@/db/schema';
import { checkPassword, setSession } from '@/lib/auth';
import { DEMO_PASSWORD, demoAccountByEmail, demoAccountByRole } from '@/lib/demo';
import { eq } from 'drizzle-orm';
import { isSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';
function redirectTo(path: string) { return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Invalid origin', { status: 403 });
  const data = await request.formData();
  const mode = String(data.get('mode') || '');
  if (mode === 'demo') {
    const demo = demoAccountByRole(String(data.get('role') || ''));
    if (!demo) return redirectTo('/login?error=Choose%20a%20demo%20account#demo');
    const token = await setSession(demo.id);
    return redirectTo(`/dashboard?t=${encodeURIComponent(token)}`);
  }
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');
  const demo = demoAccountByEmail(email);
  if (demo) {
    if (password !== DEMO_PASSWORD) return redirectTo('/login?error=Incorrect%20email%20or%20password.');
    const token = await setSession(demo.id);
    return redirectTo(`/dashboard?t=${encodeURIComponent(token)}`);
  }
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || user.isSuspended || !checkPassword(password, user.passwordHash)) return redirectTo('/login?error=Incorrect%20email%20or%20password%2C%20or%20account%20unavailable.');
  const token = await setSession(user.id);
  return redirectTo(`/dashboard?t=${encodeURIComponent(token)}`);
}
