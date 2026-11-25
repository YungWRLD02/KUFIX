'use client';
import { useEffect } from 'react';

/**
 * Keeps a signed session available even when the preview blocks third-party cookies.
 * The token travels in the URL, is stored locally, and is attached to dashboard links and forms.
 */
export default function DashboardSession({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    try { window.localStorage.setItem('kufix_token', token); window.sessionStorage.setItem('kufix_token', token); } catch {}
    fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), credentials: 'include', keepalive: true }).catch(() => {});
    const apply = () => {
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
        const href = anchor.getAttribute('href');
        if (!href || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/') || href === '/') continue;
        if (/([?&])t=/.test(href)) continue;
        if (href.startsWith('/dashboard') || href.startsWith('/request-quote') || href.startsWith('/professionals') || href.startsWith('/contact')) {
          anchor.setAttribute('href', href + (href.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(token));
        }
      }
      for (const form of Array.from(document.querySelectorAll<HTMLFormElement>('form'))) {
        if (form.querySelector('input[name="t"]')) continue;
        const action = form.getAttribute('action') || '';
        if (action.includes('logout')) continue;
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = 't'; input.value = token;
        form.appendChild(input);
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { subtree: true, childList: true });
    const logout = (event: Event) => {
      const form = event.target instanceof Element ? event.target.closest('form') : null;
      if (!form || !(form.getAttribute('action') || '').includes('logout')) return;
      try { window.localStorage.removeItem('kufix_token'); window.sessionStorage.removeItem('kufix_token'); } catch {}
    };
    document.addEventListener('submit', logout, true);
    return () => { observer.disconnect(); document.removeEventListener('submit', logout, true); };
  }, [token]);
  return null;
}
