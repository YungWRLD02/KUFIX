import { Header, Footer, PageBanner } from '@/components/site';

export const metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <>
      <Header />
      <main>
        <PageBanner
          eyebrow="USING KUFIX"
          title="Terms of use"
          description="A clear, professional guide to using the KUFIX platform."
        />
        <section className="content-section">
          <div className="container prose">
            <p>
              Welcome to KUFIX. These terms govern your access to and use of our local services
              marketplace and related tools.
            </p>

            <h2>About the platform</h2>
            <p>
              KUFIX connects clients who need everyday services with independent skilled professionals
              and businesses across Nigeria. Service providers are independent contractors, not
              employees of KUFIX. A quotation or booking request does not constitute an employment
              relationship.
            </p>

            <h2>Accounts and conduct</h2>
            <p>
              Users must provide accurate, lawful information, maintain the confidentiality of their
              login credentials, and act respectfully. Unlawful conduct, fraud, harassment, or
              uploading deceptive documents will result in immediate suspension or termination of the
              account.
            </p>

            <h2>Verification system</h2>
            <p>
              Verification badges (Phone verified, Identity checked, Business/profile reviewed, and
              Professional credentials checked) confirm that specific administrative reviews and
              document checks have been performed. Badges signify completed administrative checks
              and do not constitute an absolute guarantee of specific workmanship outcomes.
            </p>

            <h2>Quotations, bookings and escrow</h2>
            <p>
              Customers and service providers agree on job specifications, schedules, and costs
              through our quotation and booking system. When payments are held in escrow, funds are
              secured until both parties confirm that the job has been completed satisfactorily, or
              until a dispute is resolved through administrative moderation.
            </p>

            <h2>Reviews and community feedback</h2>
            <p>
              Genuine client reviews can be submitted following completed bookings. KUFIX reserves
              the right to remove abusive, fraudulent, or defamatory content upon review.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
