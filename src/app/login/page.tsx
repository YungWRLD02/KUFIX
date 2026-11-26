import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Header, Footer } from '@/components/site';

export const metadata = { title: 'Log in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <Header />
      <main className="login-page">
        <div className="container login-layout-single">
          <section className="login-card">
            <div className="eyebrow">
              <span className="eyebrow-line" /> WELCOME BACK
            </div>
            <h1>
              Good to see
              <br />
              <em>you again.</em>
            </h1>
            <p>Log in to manage your bookings, quotes, messages and profile, all in one place.</p>

            {error && <div className="alert alert-error">{error}</div>}

            <form action="/api/auth/login" method="post" className="form-stack">
              <div className="form-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button className="btn btn-primary login-submit" type="submit">
                Log in <ArrowRight size={17} />
              </button>
            </form>

            <p className="auth-bottom">
              New to KUFIX?{' '}
              <Link href="/signup">
                Create an account <ArrowRight size={14} />
              </Link>
            </p>

            <div className="login-footnote">
              <ShieldCheck size={17} />
              <span>Your account and payments are protected with bank-grade security.</span>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
