import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/site';
import { BarChart3, Bell, CalendarDays, LayoutDashboard, LifeBuoy, LogOut, Megaphone, MessagesSquare, MessageSquareText, Settings, ShieldCheck, Sparkles, Star, Users, Wrench, ArrowUpRight, Wallet, WalletMinimal } from 'lucide-react';

export type WorkspaceRole = 'customer' | 'provider' | 'admin';

const slimTabs: Record<WorkspaceRole, (keyof typeof labels)[]> = {
  customer: ['overview', 'bookings', 'messages', 'settings'],
  provider: ['overview', 'bookings', 'messages', 'settings'],
  admin: ['overview', 'users', 'messages', 'settings'],
};
const labels = {
  overview: 'Overview', posts: 'Posts', bookings: 'Bookings', quotes: 'Quote requests', messages: 'Messages', wallet: 'Wallet & escrow', reviews: 'Reviews', notifications: 'Notifications', settings: 'Profile & settings', support: 'Help & support', users: 'Users & providers', verification: 'Verification', categories: 'Services', analytics: 'Analytics',
} as const;
const icons = { overview: LayoutDashboard, posts: Megaphone, bookings: CalendarDays, quotes: MessageSquareText, messages: MessagesSquare, wallet: WalletMinimal, reviews: Star, notifications: Bell, settings: Settings, support: LifeBuoy, users: Users, verification: ShieldCheck, categories: Wrench, analytics: BarChart3 };
export const workspaceTabs: Record<WorkspaceRole, (keyof typeof labels)[]> = {
  customer: ['overview', 'posts', 'bookings', 'quotes', 'messages', 'wallet', 'reviews', 'notifications', 'settings', 'support'],
  provider: ['overview', 'posts', 'bookings', 'quotes', 'messages', 'wallet', 'verification', 'reviews', 'notifications', 'settings', 'support'],
  admin: ['overview', 'users', 'verification', 'wallet', 'categories', 'posts', 'bookings', 'quotes', 'messages', 'reviews', 'support', 'analytics', 'notifications', 'settings'],
};
export function normalizeWorkspaceTab(role: WorkspaceRole, tab?: string) { return workspaceTabs[role].includes(tab as keyof typeof labels) ? tab as keyof typeof labels : 'overview'; }
export function visibleTabs(role: WorkspaceRole, demo: boolean) { return demo ? slimTabs[role] : workspaceTabs[role]; }
export function DashboardShell({ role, name, email, tab, demo, children }: { role: WorkspaceRole; name: string; email: string; tab: string; demo: boolean; children: ReactNode }) {
  const initials = name.split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase();
  const roleTitle = role === 'provider' ? 'Provider workspace' : role === 'admin' ? 'Admin workspace' : 'Customer workspace';
  return <div className="ws-app"><aside className="ws-sidebar"><div className="ws-logo"><Logo/></div><div className="ws-role"><span className="ws-role-icon">{role === 'admin' ? <ShieldCheck size={16}/> : role === 'provider' ? <Wrench size={16}/> : <Sparkles size={16}/>}</span><span><strong>{roleTitle}</strong><small>{demo ? 'Demo account' : 'Your KUFIX account'}</small></span></div><div className="ws-nav-label">MENU</div><nav className="ws-nav" aria-label="Dashboard navigation">{visibleTabs(role, demo).map(key => { const Icon = icons[key]; const label = key === 'bookings' && role === 'provider' ? 'Job requests' : key === 'quotes' && role === 'provider' ? 'Quote opportunities' : key === 'posts' && role === 'customer' ? 'My requests' : key === 'posts' && role === 'provider' ? 'Jobs & my work' : key === 'posts' ? 'Job board' : key === 'messages' && role === 'admin' ? 'Support inbox' : key === 'wallet' && role === 'admin' ? 'Wallets & escrow' : key === 'wallet' ? 'Wallet & escrow' : labels[key]; return <a href={`/dashboard?tab=${key}`} key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined}><Icon size={18}/><span>{label}</span>{tab === key && <span className="ws-active-dot"/>}</a>; })}</nav><div className="ws-side-bottom">{demo && <a href="/login#demo"><Users size={17}/> Switch demo</a>}<a href="/"><ArrowUpRight size={17}/> Back to website</a><form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={17}/> Log out</button></form></div></aside><div className="ws-area"><header className="ws-topbar"><div className="ws-breadcrumb"><span>Workspace</span><span>/</span><strong>{labels[tab as keyof typeof labels] || 'Overview'}</strong></div><div className="ws-top-actions"><a href="/dashboard?tab=notifications" className="ws-notification" aria-label="Notifications"><Bell size={19}/><span/></a><div className="ws-user"><span className="ws-user-avatar">{initials}</span><span className="ws-user-copy"><strong>{name}</strong><small>{demo ? 'Demo account' : roleTitle}</small></span></div><form className="ws-top-logout" action="/api/auth/logout" method="post"><button type="submit" aria-label="Log out"><LogOut size={18}/></button></form></div></header><main className="ws-main">{demo && <div className="ws-demo-banner"><span className="ws-demo-banner-icon"><Sparkles size={14}/></span><div><strong>Demo workspace</strong><p>Sample data only — real accounts are unaffected.</p></div><a href="/login#demo">Switch <ArrowUpRight size={14}/></a></div>}{children}</main><div className="ws-bottom-note">© {new Date().getFullYear()} KUFIX <span>·</span> Find Skills. Get Connected. Get it Done.</div></div></div>;
}
