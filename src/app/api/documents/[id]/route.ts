import { getUser, getUserFromToken } from '@/lib/auth';
import { getDocumentFile } from '@/lib/verification';
import { providers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const token = new URL(request.url).searchParams.get('t');
  const user = (await getUser()) || (await getUserFromToken(token));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await getDocumentFile(id);
  if (!result || !result.file) return Response.json({ error: 'Not found' }, { status: 404 });
  if (user.role === 'admin') {
    // admins can view any document
  } else {
    const [provider] = await db.select().from(providers).where(eq(providers.userId, user.id)).limit(1);
    if (!provider || provider.id !== result.doc.providerId) return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return new Response(result.file, {
    status: 200,
    headers: {
      'Content-Type': result.doc.mimeType || 'application/octet-stream',
      'Content-Length': String(result.file.length),
      'Content-Disposition': `inline; filename="${result.doc.fileName.replace(/[^a-z0-9._-]/gi, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  return new Response(null, { status: 200 });
}
