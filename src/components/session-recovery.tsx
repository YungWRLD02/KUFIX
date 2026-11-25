'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SessionRecovery() {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let token: string | null = null;
    try { token = window.localStorage.getItem('kufix_token') || window.sessionStorage.getItem('kufix_token'); } catch {}
    if (token) {
      const params = new URLSearchParams(window.location.search);
      params.set('t', token);
      window.location.replace(`/dashboard?${params.toString()}`);
      return;
    }
    setChecking(false);
  }, []);
  return <main className="ws-recovery"><div className="ws-recovery-card"><img src="/images/kufix-logo.svg" alt="KUFIX" width="180" height="47"/>{checking ? <><span className="ws-recovery-spinner"/><h1>Opening your dashboard…</h1><p>Restoring your secure session. If this takes more than a moment, <a href="/login">log in</a> to continue.</p></> : <><h1>Please log in again</h1><p>Your dashboard session has ended. Log in to continue, or try a demo workspace.</p><div><Link className="ws-btn ws-btn-primary" href="/login">Go to login</Link><Link className="ws-btn ws-btn-outline" href="/login#demo">Try a demo</Link></div></>}</div></main>;
}
