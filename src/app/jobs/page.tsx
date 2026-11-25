import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, MapPin, Megaphone, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { db } from '@/db';
import { jobPosts, jobOffers, workPosts, providers, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Header, Footer, PageBanner } from '@/components/site';
import { getUser, getUserFromToken } from '@/lib/auth';
import DashboardSession from '@/components/dashboard-session';
import { getPostEngagement } from '@/lib/social';
import PostEngagement from '@/components/post-engagement';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Job board' };
const dateText = (value: Date | string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export default async function JobBoardPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const user = (await getUser()) || (await getUserFromToken(t));
  const [openJobs, offers, completed, providerRows, customerRows] = await Promise.all([
    db.select().from(jobPosts).where(eq(jobPosts.status, 'Open')).orderBy(desc(jobPosts.createdAt)).limit(30),
    db.select().from(jobOffers).orderBy(desc(jobOffers.createdAt)),
    db.select().from(workPosts).where(eq(workPosts.visible, true)).orderBy(desc(workPosts.createdAt)).limit(12),
    db.select().from(providers),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const providerName = (id: string) => providerRows.find(p => p.id === id)?.name || 'Professional';
  const allPostIds = [...openJobs.map(j => j.id), ...completed.map(w => w.id)];
  const workEngagement = await getPostEngagement('work', completed.map(w => w.id), user?.id || null);
  const jobEngagement = await getPostEngagement('job', openJobs.map(j => j.id), user?.id || null);
  const customerName = (id: string) => customerRows.find(u => u.id === id)?.name || 'Customer';
  const dashboardHref = '/dashboard?tab=posts';
  return <><DashboardSession token={t || ''}/><Header/><main>
    <PageBanner eyebrow="KUFIX JOB BOARD" title="What do you need? What have you done?" description="Customers can post a request and receive offers from professionals. Providers can publish completed jobs to show their work."/>
    <section className="jb-actions"><div className="container jb-actions-inner"><div className="jb-action-card"><span><Megaphone size={22}/></span><div><strong>Need a professional?</strong><p>Describe the job, set your location and receive offers.</p></div><Link className="ws-btn ws-btn-primary" href={dashboardHref}>{user ? 'Post what you need' : 'Post a request'} <ArrowRight size={15}/></Link></div><div className="jb-action-card alt"><span><CheckCircle2 size={22}/></span><div><strong>Completed a job?</strong><p>Publish a job-done post and build trust with customers.</p></div><Link className="ws-btn ws-btn-outline" href={user ? dashboardHref : '/become-a-provider'}>{user ? 'Post a job done' : 'Join as a provider'} <ArrowRight size={15}/></Link></div></div></section>
    <section className="section jb-section"><div className="container"><div className="section-top"><div><div className="eyebrow"><span className="eyebrow-line"/> OPEN REQUESTS</div><h2>Fresh jobs from<br/><em>real customers.</em></h2><p className="section-subtext">{openJobs.length ? `${openJobs.length} open ${openJobs.length === 1 ? 'request' : 'requests'} across Abuja.` : 'No open requests right now. New jobs will appear here.'}</p></div>{user?.role === 'provider' && <Link href={dashboardHref} className="text-link">Offer on requests <ArrowUpRight size={17}/></Link>}</div>
      {openJobs.length ? <div className="jb-grid">{openJobs.map(job => { const count = offers.filter(o => o.jobId === job.id).length; return <article className="jb-card" key={job.id}><div className="jb-card-top"><span className="jb-category">{job.category}</span><span className={`ws-badge ${job.urgency === 'Urgent' ? 'pending' : 'open'}`}><span/>{job.urgency}</span></div><h3>{job.title}</h3><p>{job.description.length > 180 ? `${job.description.slice(0, 180)}…` : job.description}</p><div className="jb-meta"><span><MapPin size={14}/>{job.location}</span><span><CalendarDays size={14}/>{dateText(job.createdAt)}</span>{job.budget && <span><Wrench size={14}/>{job.budget}</span>}</div><div className="jb-card-foot"><span>{count} {count === 1 ? 'offer' : 'offers'} · {customerName(job.customerId)}</span><Link href={dashboardHref} className="ws-text-link">Offer to help <ArrowRight size={14}/></Link></div><PostEngagement postType="job" postId={job.id} me={!!user} engagement={jobEngagement} referrer="/jobs" token={t || ''}/></article>; })}</div> : <div className="jb-empty"><ClipboardList size={26}/><h3>No open requests yet</h3><p>Be the first to post what you need.</p><Link className="ws-btn ws-btn-primary" href={dashboardHref}>Post a request</Link></div>}
    </div></section>
    <section className="section jb-work-section"><div className="container"><div className="section-top"><div><div className="eyebrow"><span className="eyebrow-line"/> JOB DONE</div><h2>Work worth<br/><em>talking about.</em></h2><p className="section-subtext">Completed-work posts shared by professionals. These are self-published updates, not verified reviews.</p></div></div>{completed.length ? <div className="jb-work-grid">{completed.map(post => <article className="jb-work-card" key={post.id}>{post.imageUrl ? <img src={post.imageUrl} alt="" className="jb-work-image" loading="lazy"/> : <div className="jb-work-placeholder"><CheckCircle2 size={27}/></div>}<div className="jb-work-body"><span className="jb-category">{post.category}</span><h3>{post.title}</h3><p>{post.description.length > 150 ? `${post.description.slice(0, 150)}…` : post.description}</p><div className="jb-meta"><span><MapPin size={14}/>{post.location}</span><span><CalendarDays size={14}/>Completed {post.completedOn}</span></div><div className="jb-card-foot"><span>{providerName(post.providerId)}</span><Link href={`/professionals/${post.providerId}`} className="ws-text-link">View profile <ArrowRight size={14}/></Link></div></div><PostEngagement postType="work" postId={post.id} me={!!user} engagement={workEngagement} referrer="/jobs" token={t || ''}/></article>)}</div> : <div className="jb-empty"><Sparkles size={26}/><h3>No completed-work posts yet</h3><p>Providers can publish their first job-done post from the dashboard.</p><Link className="ws-btn btn-outline" href="/become-a-provider">Become a provider</Link></div>}</div></section>
    <section className="final-cta"><div className="container final-inner"><div className="final-icon"><ShieldCheck size={25}/></div><h2>Keep it clear. Keep it safe.</h2><p>Agree the scope before work starts, and use chat for questions rather than sharing private details.</p><div><Link href="/professionals" className="btn btn-white">Find a professional <ArrowUpRight size={18}/></Link><Link href="/dashboard?tab=messages" className="btn btn-outline-white">Message customer care <ArrowRight size={18}/></Link></div></div></section>
  </main><Footer/></>;
}
