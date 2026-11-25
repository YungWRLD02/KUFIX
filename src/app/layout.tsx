import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './kufix.css';
import './dashboard.css';
import './community.css';
import PwaRegister from '@/components/pwa-register';
export const metadata: Metadata = { title: { default: 'KUFIX — Find Skills. Get Connected. Get it Done.', template: '%s | KUFIX' }, description: 'Discover local service professionals in Abuja. Compare profiles, request quotes, and book with confidence.', applicationName: 'KUFIX', icons: { icon: '/icon.svg', apple: '/icon-192.png' }, manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'KUFIX', statusBarStyle: 'default' } };
export const viewport: Viewport = { themeColor: '#0c2736', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body><PwaRegister/>{children}</body></html>; }