import { cookies, headers } from 'next/headers';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { demoAccountById } from '@/lib/demo';

const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || 'local-development-secret';
const cookieName = 'kufix_session_v3';
function sign(value: string) { return createHmac('sha256', secret).update(value).digest('hex'); }
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function checkPassword(password: string, stored: string) { try { const [salt, hash] = stored.split(':'); return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64)); } catch { return false; } }

async function sessionOptions() {
  const requestHeaders = await headers();
  const protocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = requestHeaders.get('host') || '';
  const secure = process.env.NODE_ENV === 'production' || protocol === 'https' || /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  return { httpOnly: true, secure, sameSite: secure ? 'none' as const : 'lax' as const, partitioned: secure, path: '/' };
}
export function createSessionToken(id: string) { return `${id}.${sign(id)}`; }
export function parseSessionToken(token: string | null | undefined) {
  if (!token) return null;
  const [id, signature] = token.split('.');
  if (!id || !signature || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const expected = Buffer.from(sign(id), 'hex');
    const received = Buffer.from(signature, 'hex');
    if (expected.length !== received.length || !timingSafeEqual(received, expected)) return null;
    return id;
  } catch { return null; }
}
export async function setSession(id: string) {
  const token = createSessionToken(id);
  try { (await cookies()).set(cookieName, token, { ...await sessionOptions(), maxAge: 60 * 60 * 24 * 14 }); } catch {}
  return token;
}
export async function clearSession() {
  const store = await cookies();
  try { store.set(cookieName, '', { ...await sessionOptions(), maxAge: 0 }); } catch {}
  store.delete('kufix_session');
  store.delete('kufix_session_v2');
}
export async function getUserFromToken(token: string | null | undefined) {
  const id = parseSessionToken(token);
  if (!id) return null;
  const demo = demoAccountById(id);
  if (demo) return { ...demo, passwordHash: '', isSuspended: false, createdAt: new Date(0) };
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user && !user.isSuspended ? user : null;
}
export async function getUser() {
  const cookie = (await cookies()).get(cookieName)?.value;
  return getUserFromToken(cookie);
}
export async function requireUser(role?: string) { const user = await getUser(); if (!user) redirect('/login?next=%2Fdashboard'); if (role && user.role !== role && user.role !== 'admin') redirect('/dashboard'); return user; }
/** Resolve the signed-in account for a server action, using the form token when cookies are unavailable. */
export async function requireFormUser(data: FormData, role?: string) {
  const token = String(data.get('t') || '');
  const user = (await getUser()) || (await getUserFromToken(token));
  if (!user) redirect('/login?error=Session%20expired.%20Please%20log%20in%20again.');
  if (role && user.role !== role && user.role !== 'admin') redirect('/dashboard');
  return user;
}
