import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header, Footer } from '@/components/site';
import { getProvider, servicesOfferedList } from '@/lib/marketplace';
import { getUser, getUserFromToken } from '@/lib/auth';
import DashboardSession from '@/components/dashboard-session';
import SafeAvatar from '@/components/safe-avatar';
import { bookingAction } from '@/app/actions';
import { startProviderChatAction } from '@/app/community/actions';
import { db } from '@/db';
import { reviews } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; t?: string }>;
}) {
  const { id } = await params;
  const { error, t } = await searchParams;
  const provider = await getProvider(id);
  if (!provider) notFound();

  const allServices = servicesOfferedList(provider);
  const user = (await getUser()) || (await getUserFromToken(t));
  const providerReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.providerId, id), eq(reviews.hidden, false)));
  const avg = providerReviews.length
    ? providerReviews.reduce((a, b) => a + b.rating, 0) / providerReviews.length
    : 0;

  const initials = provider.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  return (
    <>
      <DashboardSession token={t || ''} />
      <Header />
      <main>
        <div className="container" style={{ padding: '28px 0 65px' }}>
          <Link
            href="/professionals"
            className="small-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 25 }}
          >
            <ArrowLeft size={15} /> Back to professionals
          </Link>
          <div className="profile-layout">
            <div className="profile-main">
              <div className="profile-header">
                <div className="profile-avatar">
                  {provider.avatar ? (
                    <SafeAvatar src={provider.avatar} alt={provider.name} initials={initials} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <span className="eyebrow">{provider.category}</span>
                  <h1>{provider.name}</h1>
                  <p>
                    <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    {provider.location}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
                <span className="profile-label">
                  <ShieldCheck size={14} />
                  {provider.verification === 'Not verified'
                    ? 'Verification pending'
                    : provider.verification}
                </span>
                <span className="profile-label">
                  {provider.available ? 'Available for requests' : 'Currently unavailable'}
                </span>
                {providerReviews.length > 0 && (
                  <span className="profile-label">
                    <Star size={13} fill="currentColor" /> {avg.toFixed(1)} ·{' '}
                    {providerReviews.length} reviews
                  </span>
                )}
              </div>

              <section className="profile-section">
                <h2>About {provider.name.split(' ')[0]}</h2>
                <p>{provider.bio}</p>
              </section>

              <section className="profile-section">
                <h2>At a glance</h2>
                <div className="detail-list">
                  <div>
                    <BriefcaseBusiness size={17} />
                    <span>{provider.experience || 'Experience not provided'}</span>
                  </div>
                  <div>
                    <MapPin size={17} />
                    <span>Serving {provider.area}</span>
                  </div>
                  <div>
                    <ShieldCheck size={17} />
                    <span>
                      {provider.verification === 'Not verified'
                        ? 'Verification has not yet been completed'
                        : provider.verification}
                    </span>
                  </div>
                </div>
              </section>

              <section className="profile-section">
                <h2>Services offered</h2>
                <div className="pill-list">
                  {allServices.map((service) => (
                    <span key={service} className="pill">
                      {service}
                      {service === provider.category ? ' (primary)' : ''}
                    </span>
                  ))}
                </div>
              </section>

              <section className="profile-section">
                <h2>Reviews & ratings</h2>
                {providerReviews.length ? (
                  providerReviews.map((r) => (
                    <div key={r.id} style={{ borderTop: '1px solid #e8eeec', padding: '16px 0' }}>
                      <div style={{ color: '#d39b42', fontSize: 13 }}>
                        {'★'.repeat(r.rating)}
                        {'☆'.repeat(5 - r.rating)}
                      </div>
                      <p style={{ margin: '6px 0 0' }}>{r.comment}</p>
                    </div>
                  ))
                ) : (
                  <p>No reviews yet. Reviews appear here after a completed booking.</p>
                )}
              </section>

              <section className="profile-section">
                <h2>Understanding verification</h2>
                <p>
                  Phone, identity, business/profile and professional-credential checks are conducted
                  through manual administrative review and NIMC verification.
                </p>
              </section>
            </div>

            <aside className="profile-side">
              <h3>Request a Quotation</h3>
              <p>
                Describe what you need and {provider.name.split(' ')[0]} will review your request and
                send a quotation. No upfront payment is required until you approve their quote.
              </p>

              {error && <div className="alert alert-error">{error}</div>}

              {user?.role === 'provider' ? (
                <p>
                  Provider accounts cannot request services. Sign in with a customer account to
                  continue.
                </p>
              ) : (
                <form action={bookingAction} className="form-stack" id="book">
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="t" value={t || ''} />
                  <div className="form-field">
                    <label htmlFor="service">Service required *</label>
                    <input
                      id="service"
                      name="service"
                      defaultValue={provider.category}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="description">Describe the job *</label>
                    <textarea
                      id="description"
                      name="description"
                      placeholder="Tell us what needs doing in detail..."
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="budget">Estimated budget / target price (₦, optional)</label>
                    <input
                      id="budget"
                      name="budget"
                      type="number"
                      min="100"
                      step="100"
                      placeholder="e.g. 15000 (leave blank for provider quotation)"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="date">Preferred date *</label>
                      <input id="date" name="date" type="date" required />
                    </div>
                    <div className="form-field">
                      <label htmlFor="time">Preferred time *</label>
                      <input id="time" name="time" type="time" required />
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="location">Service location *</label>
                    <input
                      id="location"
                      name="location"
                      placeholder="Address or area in Abuja"
                      defaultValue={user?.location || ''}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="instructions">Additional instructions</label>
                    <textarea
                      id="instructions"
                      name="instructions"
                      placeholder="Anything else the provider should know?"
                      style={{ minHeight: 65 }}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit">
                    <FileText size={17} /> {user ? 'Submit Quote Request' : 'Sign in to request a quote'}
                  </button>
                </form>
              )}

              <Link
                href={`/request-quote?category=${encodeURIComponent(provider.category)}`}
                className="btn btn-outline"
              >
                Request multiple quotes from this category
              </Link>

              {user?.role === 'customer' && provider.userId && (
                <details className="ws-inline-details profile-chat">
                  <summary>Message {provider.name.split(' ')[0]}</summary>
                  <form action={startProviderChatAction} className="ws-form-grid single">
                    <input type="hidden" name="t" value={t || ''} />
                    <input type="hidden" name="providerId" value={provider.id} />
                    <label>
                      Your message
                      <textarea
                        name="message"
                        placeholder="Ask about availability, the job or pricing..."
                        required
                      />
                    </label>
                    <button className="ws-btn ws-btn-primary">
                      Send message <ArrowRight size={15} />
                    </button>
                  </form>
                </details>
              )}

              <p className="helper-text">
                KUFIX Safe Payment: Request quote → Receive quotation → Accept & pay into escrow →
                Provider completes job → Both confirm → Funds released.
              </p>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
