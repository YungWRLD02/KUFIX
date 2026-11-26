import { db } from '@/db';
import { users } from '@/db/schema';
import { checkPassword, setSession } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { isSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

function redirectTo(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return new Response('Invalid origin', { status: 403 });
  }

  const data = await request.formData();
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = String(data.get('password') || '');

  if (!email || !password) {
    return redirectTo('/login?error=Please%20enter%20both%20email%20and%20password.');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${email}`)
    .limit(1);

  if (!user || user.isSuspended || !checkPassword(password, user.passwordHash)) {
    return redirectTo(
      '/login?error=Incorrect%20email%20or%20password%2C%20or%20account%20unavailable.'
    );
  }

  const token = await setSession(user.id);
  return redirectTo(`/dashboard?t=${encodeURIComponent(token)}`);
}
