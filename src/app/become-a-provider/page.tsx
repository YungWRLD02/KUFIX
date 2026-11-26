import Link from 'next/link';
import { Header, Footer, PageBanner } from '@/components/site';
import { ArrowUpRight, BriefcaseBusiness, ClipboardList, UserRoundCheck } from 'lucide-react';

export const metadata = { title: 'Become a provider' };

export default function ProviderPage() {
  return (
    <>
      <Header />
      <main>
        <PageBanner
          eyebrow="GROW WITH KUFIX"
          title="Your next customer is looking for your skills."
          description="Build your professional digital presence, showcase verified completed projects, and manage client bookings from one powerful workspace."
        />
        <section className="content-section">
          <div className="container">
            <div className="info-grid">
              <div className="info-card">
                <UserRoundCheck size={29} />
                <h3>Create your profile</h3>
                <p>
                  List your primary and secondary trade services, experience, certifications, and
                  coverage areas across Abuja and nationwide.
                </p>
              </div>
              <div className="info-card">
                <ClipboardList size={29} />
                <h3>Receive requests</h3>
                <p>
                  Review client quote requests, submit customized pricing, or receive direct job
                  bookings with escrow-backed protection.
                </p>
              </div>
              <div className="info-card">
                <BriefcaseBusiness size={29} />
                <h3>Build your business</h3>
                <p>
                  Publish photos of completed work, collect verified client reviews, earn trust
                  badges, and scale your income.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 47,
                padding: '39px',
                borderRadius: 12,
                background: '#0c2736',
                color: 'white',
                textAlign: 'center',
              }}
            >
              <h2 style={{ fontSize: 31, letterSpacing: '-1px', margin: '0 0 10px' }}>
                Ready to show what you do best?
              </h2>
              <p style={{ color: '#b1c5c7', fontSize: 14, margin: '0 0 24px' }}>
                Creating a service provider profile is free. Start connecting with local clients today.
              </p>
              <Link href="/signup?role=provider" className="btn btn-primary">
                Join as a provider <ArrowUpRight size={18} />
              </Link>
            </div>

            <p className="sample-note" style={{ marginTop: 22 }}>
              All professional profiles are eligible for document verification and credential review
              to earn the verified trust badge.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
