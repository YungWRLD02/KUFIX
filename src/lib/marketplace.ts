import { db } from '@/db';
import { providers, serviceCategories } from '@/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { categoriesSeed } from '@/db/seed/data/categories';

export const categories = categoriesSeed;

export async function getAllCategories() {
  const existing = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.name));
  if (existing.length === 0) {
    // If not yet seeded, return the master category list
    return categoriesSeed.map((c) => ({
      id: c.slug,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      tone: c.tone,
      isActive: true,
      createdAt: new Date(),
    }));
  }
  return existing;
}

export async function getCategories() {
  const all = await getAllCategories();
  return all.filter((c) => c.isActive);
}

export async function getProviders() {
  return db
    .select()
    .from(providers)
    .where(eq(providers.available, true))
    .orderBy(desc(providers.createdAt));
}

export function offersCategory(
  p: { category: string; servicesOffered?: string | null },
  category: string
) {
  if (!category) return true;
  if (p.category === category) return true;
  return (p.servicesOffered || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .includes(category);
}

export function servicesOfferedList(p: {
  category: string;
  servicesOffered?: string | null;
}) {
  const extras = (p.servicesOffered || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => c !== p.category);
  return [p.category, ...extras];
}

export async function getProvider(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return undefined;
  }
  const result = await db
    .select()
    .from(providers)
    .where(eq(providers.id, id))
    .limit(1);
  return result[0];
}

export function categorySlug(name: string) {
  return categories.find((c) => c.name === name)?.slug ?? '';
}
