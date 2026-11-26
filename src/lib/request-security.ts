export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const source = new URL(origin);
    if (!['http:', 'https:'].includes(source.protocol)) return false;
    const forwarded = request.headers.get('x-forwarded-host')?.split(',').map(value => value.trim()) || [];
    const referer = request.headers.get('referer');
    let refererHost = '';
    if (referer) {
      try { refererHost = new URL(referer).host; } catch {}
    }
    const hostHeader = request.headers.get('host') || '';
    const urlHost = new URL(request.url).host;
    const hosts: string[] = [hostHeader, urlHost, refererHost, ...forwarded].filter(Boolean);
    if (hosts.some(h => h === source.host)) return true;
    // Behind reverse proxies (e.g. preview sandboxes, cloud edges) internal host is often 127.0.0.1 or localhost
    const isLocalHost = hosts.some(h => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h));
    if (isLocalHost) return true;
    return false;
  } catch { return true; }
}
