import { Header, Footer, PageBanner } from '@/components/site';

export const metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main>
        <PageBanner
          eyebrow="YOUR DATA MATTERS"
          title="Privacy policy"
          description="How KUFIX handles, protects, and respects the personal information you share with us."
        />
        <section className="content-section">
          <div className="container prose">
            <p>
              At KUFIX, we take data protection and user privacy seriously. This Privacy Policy
              describes how we collect, process, and safeguard your personal data in accordance with
              the Nigeria Data Protection Act (NDPA) and global industry standards.
            </p>

            <h2>Information we collect</h2>
            <p>
              When you create an account, we collect your name, email address, telephone number, and
              operating location. For service providers, we also collect trade classifications,
              service descriptions, portfolio images, and government-issued identification documents
              submitted for verification purposes.
            </p>

            <h2>How we use your information</h2>
            <p>
              We process personal information to provide marketplace services, facilitate direct
              communications between clients and professionals, secure escrow transactions, verify
              professional credentials, and provide responsive customer support. Public profiles
              display only designated business information and never disclose private personal contact
              data without authorization.
            </p>

            <h2>Security and document retention</h2>
            <p>
              All account passwords are encrypted using one-way scrypt key derivation. Verification
              documents are stored in secure private storage accessible exclusively to authorized
              compliance personnel for identity review.
            </p>

            <h2>Your rights and account management</h2>
            <p>
              You maintain full control over your personal information. You can edit your profile,
              service offerings, and contact details directly through your KUFIX Dashboard or contact
              our data protection officer via the Contact Us page.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
