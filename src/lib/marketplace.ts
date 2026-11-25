import { db } from '@/db';
import { providers, serviceCategories } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export const categories = [
  { name: 'Electrical', slug: 'electrical', description: 'Wiring, lighting & electrical repairs', icon: 'Zap', tone: 'mint' },
  { name: 'Plumbing', slug: 'plumbing', description: 'Leaks, pipes & water systems', icon: 'Droplets', tone: 'blue' },
  { name: 'AC & Refrigeration', slug: 'ac-refrigeration', description: 'Cooling, servicing & repairs', icon: 'Snowflake', tone: 'lavender' },
  { name: 'Generator & Inverter', slug: 'generator-inverter', description: 'Reliable power, made simple', icon: 'BatteryCharging', tone: 'peach' },
  { name: 'Cleaning', slug: 'cleaning', description: 'A fresher home or workspace', icon: 'Sparkles', tone: 'yellow' },
  { name: 'Carpentry & Furniture', slug: 'carpentry-furniture', description: 'Furniture, doors & woodwork', icon: 'Hammer', tone: 'rose' },
];

export async function getAllCategories() {
  await db.insert(serviceCategories).values(categories.map(c => ({ ...c, isActive: true }))).onConflictDoNothing();
  return db.select().from(serviceCategories).orderBy(asc(serviceCategories.createdAt));
}
export async function getCategories() { return (await getAllCategories()).filter(c => c.isActive); }

const demos = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Tunde Adebayo', category: 'Electrical', location: 'Wuse 2, Abuja', area: 'Wuse, Maitama, Garki', bio: 'Thoughtful electrical installations and repairs for homes and small businesses.', experience: '7 years experience', avatar: '/images/providers/7163464.jpg' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Adaeze Okonkwo', category: 'Cleaning', location: 'Gwarinpa, Abuja', area: 'Gwarinpa, Jabi, Wuse', bio: 'Detail-focused home and office cleaning, from regular upkeep to deep cleans.', experience: '5 years experience', avatar: '/images/providers/37079379.jpg' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Chinedu Eze', category: 'Plumbing', location: 'Jabi, Abuja', area: 'Jabi, Utako, Wuse', bio: 'Practical plumbing solutions for leaks, fittings, pumps and maintenance.', experience: '8 years experience', avatar: '/images/providers/37070438.jpg' },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Ibrahim Musa', category: 'AC & Refrigeration', location: 'Garki, Abuja', area: 'Garki, Asokoro, Wuse', bio: 'AC installation, routine servicing and cooling system troubleshooting.', experience: '6 years experience', avatar: '/images/providers/8044100.jpg' },
  { id: '55555555-5555-4555-8555-555555555555', name: 'Emeka Nwosu', category: 'Generator & Inverter', location: 'Maitama, Abuja', area: 'Maitama, Wuse, Jabi', bio: 'Generator servicing and inverter support to keep your space powered.', experience: '9 years experience', avatar: '/images/providers/12311546.jpg' },
  { id: '66666666-6666-4666-8666-666666666666', name: 'Bola Ajayi', category: 'Carpentry & Furniture', location: 'Lugbe, Abuja', area: 'Lugbe, Garki, Wuse', bio: 'Careful furniture repairs, assembly and custom woodwork for everyday spaces.', experience: '6 years experience', avatar: '/images/providers/31637720.jpg' },
];

export async function getProviders() {
  const existing = await db.select().from(providers).orderBy(asc(providers.createdAt));
  if (existing.length === 0) {
    await db.insert(providers).values(demos.map(p => ({ ...p, isDemo: true, verification: 'Not verified' }))).onConflictDoNothing();
    return db.select().from(providers).orderBy(asc(providers.createdAt));
  }
  return existing;
}

export function offersCategory(p: { category: string; servicesOffered?: string | null }, category: string) {
  if (!category) return true;
  if (p.category === category) return true;
  return (p.servicesOffered || '').split(',').map(c => c.trim()).filter(Boolean).includes(category);
}

export function servicesOfferedList(p: { category: string; servicesOffered?: string | null }) {
  const extras = (p.servicesOffered || '').split(',').map(c => c.trim()).filter(Boolean).filter(c => c !== p.category);
  return [p.category, ...extras];
}

export async function getProvider(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
  const result = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
  return result[0];
}

export function categorySlug(name: string) { return categories.find(c => c.name === name)?.slug ?? ''; }
