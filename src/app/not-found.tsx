import Link from 'next/link';
import { Header, Footer } from '@/components/site';
export default function NotFound() {
  return <><Header/><main className="ws-recovery"><div className="ws-recovery-card"><span className="ws-eyebrow">404 · PAGE NOT FOUND</span><h1>This page isn’t here.</h1><p>The link may be out of date. Head back to the homepage, or open your dashboard if you’re signed in.</p><div><Link className="ws-btn ws-btn-primary" href="/">Go to homepage</Link><Link className="ws-btn ws-btn-outline" href="/dashboard">Open dashboard</Link><Link className="ws-btn ws-btn-outline" href="/login#demo">Try a demo</Link></div></div></main><Footer/></>;
}
