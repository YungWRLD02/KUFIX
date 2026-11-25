import { db } from '@/db';
import { users, providers } from '@/db/schema';
import { hashPassword, setSession } from '@/lib/auth';
import { demoAccountByEmail } from '@/lib/demo';
import { getCategories } from '@/lib/marketplace';
import { eq } from 'drizzle-orm';
import { isSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';
function redirectTo(path: string) { return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Invalid origin', { status: 403 });
  const data = await request.formData();
  const val = (key: string) => String(data.get(key) || '').trim();
  const role = val('role') === 'provider' ? 'provider' : 'customer';
  const fail = (message: string) => redirectTo(`/signup?role=${role}&error=${encodeURIComponent(message)}`);
  const name = val('name'), email = val('email').toLowerCase(), phone = val('phone'), location = val('location'), password = val('password'), category = val('category'), bio = val('bio');
  const servicesOffered = data.getAll('servicesOffered').map(String).filter(c => c && c !== category).slice(0, 12);
  if (!name || name.length > 180 || !email.includes('@') || email.length > 255 || !phone || phone.length > 30 || !location || location.length > 180 || password.length < 8 || password.length > 512) return fail('Complete all fields and use a password of at least 8 characters.');
  if (demoAccountByEmail(email)) return fail('That address is reserved for a demo account.');
  const categories = await getCategories();
  if (role === 'provider' && (!categories.some(c => c.name === category) || !bio)) return fail('Please add your service category and description.');
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return fail('An account with this email already exists.');
  try {
    const user = await db.transaction(async tx => {
      const [created] = await tx.insert(users).values({ name, email, phone, location, role, passwordHash: hashPassword(password) }).returning();
      if (role === 'provider') await tx.insert(providers).values({ userId: created.id, name, category, location, area: location, bio, servicesOffered: servicesOffered.join(', ') });
      return created;
    });
    const token = await setSession(user.id);
    return redirectTo(`/dashboard?t=${encodeURIComponent(token)}`);
  } catch {
    return fail('Unable to create the account. Please try again or use another email.');
  }
}
