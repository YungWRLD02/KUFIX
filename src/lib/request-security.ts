export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const source = new URL(origin);
    if (!['http:', 'https:'].includes(source.protocol)) return false;
    const forwarded = request.headers.get('x-forwarded-host')?.split(',').map(value => value.trim()) || [];
    const hosts = [request.headers.get('host'), new URL(request.url).host, ...forwarded].filter(Boolean);
    return hosts.includes(source.host);
  } catch { return false; }
}
