// These identities are intentionally public and only open the isolated sample dashboard.
export const DEMO_PASSWORD = 'Demo123!';
export const DEMO_ACCOUNTS = [
  { id: '00000000-0000-4000-8000-000000000001', role: 'customer', name: 'Amaka Okafor', email: 'customer@kufix.test', phone: '+234 000 000 0000', location: 'Wuse 2, Abuja' },
  { id: '00000000-0000-4000-8000-000000000002', role: 'provider', name: 'Tunde Adebayo', email: 'provider@kufix.test', phone: '+234 000 000 0000', location: 'Garki, Abuja' },
  { id: '00000000-0000-4000-8000-000000000003', role: 'admin', name: 'KUFIX Admin', email: 'admin@kufix.test', phone: '+234 000 000 0000', location: 'Abuja' },
] as const;
export type DemoRole = (typeof DEMO_ACCOUNTS)[number]['role'];
export function demoAccountById(id: string) { return DEMO_ACCOUNTS.find(account => account.id === id); }
export function demoAccountByEmail(email: string) { return DEMO_ACCOUNTS.find(account => account.email === email.toLowerCase()); }
export function demoAccountByRole(role: string) { return DEMO_ACCOUNTS.find(account => account.role === role); }
export function isDemoUser(user: { id: string } | null | undefined) { return !!user && !!demoAccountById(user.id); }
