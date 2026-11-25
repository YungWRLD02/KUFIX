'use client';
import Link from 'next/link';
import { useEffect } from 'react';
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="ws-recovery"><div className="ws-recovery-card"><img src="/images/kufix-logo.svg" alt="KUFIX" width="180" height="47"/><h1>We couldn’t open your dashboard</h1><p>Your session may have changed while the page was loading. Try again, or sign in with your demo account.</p><div><button type="button" className="ws-btn ws-btn-primary" onClick={() => reset()}>Try again</button><Link className="ws-btn ws-btn-outline" href="/login">Go to login</Link></div></div></main>;
}
