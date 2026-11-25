'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, CheckCircle2, ClipboardList, Clock3, LifeBuoy, MapPin, MessageSquareText, Send, ShieldCheck, Sparkles, Users, Wrench } from 'lucide-react';
import type { DemoRole } from '@/lib/demo';

type Booking = { id: number; service: string; person: string; date: string; location: string; description: string; status: string };
const sampleBookings: Record<DemoRole, Booking[]> = {
  customer: [
    { id: 1, service: 'Lighting installation', person: 'Tunde Adebayo', date: 'Tomorrow · 10:00 AM', location: 'Wuse 2, Abuja', description: 'Install three new light fittings in the living room.', status: 'Pending' },
    { id: 2, service: 'Plumbing repair', person: 'Chinedu Eze', date: 'Friday · 11:30 AM', location: 'Wuse 2, Abuja', description: 'Check a leaking kitchen tap and replace the fitting.', status: 'Accepted' },
    { id: 3, service: 'Home cleaning', person: 'Adaeze Okonkwo', date: 'Last week', location: 'Wuse 2, Abuja', description: 'A one-time deep clean of a two-bedroom apartment.', status: 'Completed' },
  ],
  provider: [
    { id: 1, service: 'Lighting installation', person: 'Amaka Okafor', date: 'Tomorrow · 10:00 AM', location: 'Wuse 2, Abuja', description: 'Install three new light fittings in the living room.', status: 'Pending' },
    { id: 2, service: 'Electrical fault diagnosis', person: 'Ibrahim Yusuf', date: 'Friday · 2:00 PM', location: 'Maitama, Abuja', description: 'Check a socket that has stopped working.', status: 'Accepted' },
    { id: 3, service: 'Switch replacement', person: 'Ada Nwosu', date: 'Last week', location: 'Garki, Abuja', description: 'Replace two light switches in the hallway.', status: 'Completed' },
  ],
  admin: [
    { id: 1, service: 'Lighting installation', person: 'Amaka → Tunde', date: 'Tomorrow · 10:00 AM', location: 'Wuse 2, Abuja', description: 'Install three new light fittings.', status: 'Pending' },
    { id: 2, service: 'Plumbing repair', person: 'Amaka → Chinedu', date: 'Friday · 11:30 AM', location: 'Wuse 2, Abuja', description: 'Repair a leaking kitchen tap.', status: 'Accepted' },
    { id: 3, service: 'Home cleaning', person: 'Amaka → Adaeze', date: 'Last week', location: 'Gwarinpa, Abuja', description: 'A one-time deep clean.', status: 'Completed' },
  ],
};
const roleCopy = {
  customer: { label: 'CUSTOMER WORKSPACE', name: 'Amaka', text: 'Your jobs, bookings and conversation — all in one place.', action: 'View my bookings', actionTab: 'bookings' },
  provider: { label: 'PROVIDER WORKSPACE', name: 'Tunde', text: 'Your requests, quotes and business at a glance.', action: 'View requests', actionTab: 'bookings' },
  admin: { label: 'ADMIN WORKSPACE', name: 'KUFIX', text: 'A clear view of marketplace activity and moderation.', action: 'View users', actionTab: 'users' },
} as const;

function Status({ value }: { value: string }) { return <span className={`ws-badge ${value.toLowerCase().replace(/[^a-z]+/g, '-')}`}><span/>{value}</span>; }
function Heading({ eyebrow, title, text, href, action }: { eyebrow: string; title: string; text: string; href?: string; action?: string }) { return <div className="ws-page-heading"><div><span className="ws-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{href && <a href={href} className="ws-btn ws-btn-primary">{action}<ArrowUpRight size={16}/></a>}</div>; }
function CardHeading({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) { return <div className="ws-card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{href && <a href={href} className="ws-text-link">View all <ArrowRight size={15}/></a>}</div>; }

const sampleUsers = [
  { name: 'Amaka Okafor', type: 'Customer · Wuse 2, Abuja' },
  { name: 'Tunde Adebayo', type: 'Provider · Electrical · Garki, Abuja' },
  { name: 'Adaeze Okonkwo', type: 'Provider · Cleaning · Gwarinpa, Abuja' },
];

export default function DemoDashboard({ role, email, initialTab = 'overview', notice }: { role: DemoRole; email: string; initialTab?: string; notice?: string }) {
  const [items, setItems] = useState(sampleBookings[role]);
  const [feedback, setFeedback] = useState(notice === 'demo' ? 'That action requires a real account — you can explore the sample data here.' : '');
  const [chatThread, setChatThread] = useState('provider');
  const [chatDraft, setChatDraft] = useState('');
  const [chatLog, setChatLog] = useState<Record<string, { id: number; sender: string; body: string }[]>>({ provider: [{ id: 1, sender: role === 'admin' ? 'Amaka Okafor' : 'Tunde Adebayo', body: 'Hi! I can see your job. I can start tomorrow morning. How does that sound?' }, { id: 2, sender: 'You', body: 'Great, that works.' }] });
  const [name] = useState(role === 'customer' ? 'Amaka Okafor' : role === 'provider' ? 'Tunde Adebayo' : 'KUFIX Admin');
  const pending = items.filter(b => b.status === 'Pending').length;
  const completed = items.filter(b => b.status === 'Completed').length;
  function changeStatus(id: number, status: string) { setItems(current => current.map(item => item.id === id ? { ...item, status } : item)); setFeedback(`Sample booking marked ${status.toLowerCase()}.`); }
  function simulate(event: FormEvent<HTMLFormElement>, message: string) { event.preventDefault(); setFeedback(message); }

  const copy = roleCopy[role];
  const stats = role === 'admin'
    ? [{ label: 'Total users', value: 3, icon: Users, color: 'teal', detail: 'Sample accounts' }, { label: 'Providers', value: 2, icon: Wrench, color: 'blue', detail: 'Sample profiles' }, { label: 'Bookings', value: items.length, icon: CalendarDays, color: 'amber', detail: `${completed} completed` }]
    : [{ label: 'Total requests', value: items.length, icon: CalendarDays, color: 'teal', detail: 'Sample activity' }, { label: 'Pending', value: pending, icon: Clock3, color: 'amber', detail: 'Awaiting action' }, { label: 'Completed', value: completed, icon: CheckCircle2, color: 'purple', detail: 'Sample activity' }];

  return <>{feedback && <div className="ws-alert success" role="status"><CheckCircle2 size={17}/>{feedback}</div>}

  {initialTab === 'overview' && <><Heading eyebrow={`${copy.label} · SAMPLE`} title={`Welcome back, ${copy.name}.`} text={copy.text} href={copy.actionTab === 'users' ? '/dashboard?tab=users' : '/dashboard?tab=bookings'} action={copy.action}/><div className="ws-stats">{stats.map(s => <div className="ws-stat" key={s.label}><div className={`ws-stat-icon ${s.color}`}><s.icon size={20}/></div><div className="ws-stat-copy"><span>{s.label}</span><strong>{s.value}</strong><small>{s.detail}</small></div></div>)}</div><div className="ws-overview-grid"><section className="ws-card"><CardHeading title="Recent activity" subtitle="Sample activity for this demo." href="/dashboard?tab=bookings"/><div className="ws-list">{items.map(item => <div className="ws-list-row" key={item.id}><span className="ws-row-icon"><Wrench size={18}/></span><div className="ws-row-main"><strong>{item.service}</strong><small>{item.person} · {item.location}</small></div><div className="ws-row-end"><Status value={item.status}/><small>{item.date}</small></div></div>)}</div></section><aside className="ws-overview-side"><div className="ws-trust-card"><ShieldCheck size={22}/><div><strong>Good to know</strong><p>This is a sample preview — real account data is unaffected by anything here.</p></div></div></aside></div></>}

  {initialTab === 'bookings' && <><Heading eyebrow="SAMPLE ACTIVITY" title={role === 'provider' ? 'Job requests' : role === 'admin' ? 'Booking management' : 'My bookings'} text="Sample bookings — explore how a request moves forward."/><section className="ws-card"><CardHeading title="All bookings" subtitle="Illustrative data only."/><div className="ws-records">{items.map(item => <article className="ws-record" key={item.id}><div className="ws-record-top"><div className="ws-record-title"><span className="ws-row-icon"><Wrench size={18}/></span><div><h3>{item.service}</h3><p>{item.person}</p></div></div><Status value={item.status}/></div><p className="ws-record-description">{item.description}</p><div className="ws-record-meta"><span><CalendarDays size={15}/>{item.date}</span><span><MapPin size={15}/>{item.location}</span></div><div className="ws-record-actions">{role === 'provider' && item.status === 'Pending' && <><button className="ws-btn ws-btn-small ws-btn-primary" onClick={() => changeStatus(item.id, 'Accepted')}>Accept request</button><button className="ws-btn ws-btn-small ws-btn-outline" onClick={() => changeStatus(item.id, 'Rejected')}>Decline</button></>}{role === 'provider' && (item.status === 'Accepted' || item.status === 'In Progress') && <button className="ws-btn ws-btn-small ws-btn-primary" onClick={() => changeStatus(item.id, item.status === 'Accepted' ? 'In Progress' : 'Completed')}>{item.status === 'Accepted' ? 'Start job' : 'Mark completed'}</button>}{role === 'customer' && item.status === 'Pending' && <button className="ws-btn ws-btn-small ws-btn-outline" onClick={() => changeStatus(item.id, 'Cancelled')}>Cancel request</button>}</div></article>)}</div></section></>}

  {initialTab === 'users' && role === 'admin' && <><Heading eyebrow="PLATFORM MANAGEMENT" title="Sample accounts." text="The demo view of user and provider management."/><section className="ws-card"><CardHeading title="Registered accounts" subtitle="Sample data."/><div className="ws-list">{sampleUsers.map(u => <div className="ws-list-row" key={u.name}><span className="ws-initials">{u.name.split(' ').map(n => n[0]).join('')}</span><div className="ws-row-main"><strong>{u.name}</strong><small>{u.type}</small></div><div className="ws-row-end"><Status value="Active"/></div></div>)}</div></section></>}

  {initialTab === 'messages' && <><Heading eyebrow="STAY CONNECTED" title={role === 'admin' ? 'Support conversations.' : 'Messages.'} text="Try a sample conversation. Nothing is sent to real people."/><div className="chat-layout"><aside className="chat-threads"><div className="chat-threads-head"><span className="ws-eyebrow">CONVERSATIONS</span><strong>1</strong></div><button type="button" className="chat-thread active" onClick={() => setChatThread('provider')}><span className="chat-avatar"><Wrench size={16}/></span><span className="chat-thread-copy"><strong>{role === 'admin' ? 'Support · Tunde' : role === 'provider' ? 'Amaka Okafor' : 'Tunde Adebayo'}</strong><small>About the lighting job</small><em>Sample</em></span></button></aside><section className="chat-window"><header className="chat-window-head"><span className="chat-avatar"><Wrench size={18}/></span><div><strong>{role === 'admin' ? 'Support · Tunde' : role === 'provider' ? 'Amaka Okafor' : 'Tunde Adebayo'}</strong><small>Sample conversation · Demo only</small></div></header><div className="chat-messages">{(chatLog[chatThread] || []).map(message => <div key={message.id} className={`chat-message ${message.sender === 'You' ? 'mine' : 'theirs'}`}><div className="chat-bubble">{message.body}</div><span className="chat-meta">{message.sender}</span></div>)}</div><form className="chat-composer" onSubmit={event => { event.preventDefault(); const body = chatDraft.trim(); if (!body) return; setChatLog(current => ({ ...current, [chatThread]: [...(current[chatThread] || []), { id: Date.now(), sender: 'You', body }] })); setChatDraft(''); }}><textarea value={chatDraft} onChange={event => setChatDraft(event.target.value)} placeholder="Write a sample message..." rows={2}/><button className="ws-btn ws-btn-primary" type="submit" disabled={!chatDraft.trim()}>Send <Send size={15}/></button></form></section></div></>}

  {initialTab === 'settings' && <><Heading eyebrow="YOUR ACCOUNT" title="Profile & settings." text="Preview your sample account details."/><section className="ws-card"><CardHeading title="Personal information" subtitle="Demo only — nothing is saved."/><form className="ws-form-grid single" onSubmit={event => simulate(event, 'Sample profile updated. No real account was changed.')}><label>Full name<input defaultValue={name} required/></label><label>Email address<input type="email" defaultValue={email} disabled/></label><label>Phone number<input defaultValue="+234 000 000 0000"/></label><label>Location<input defaultValue="Abuja"/></label><button className="ws-btn ws-btn-primary">Save sample changes <ArrowRight size={16}/></button></form></section></>}

  </>;
}
