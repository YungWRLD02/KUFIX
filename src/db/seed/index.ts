import 'dotenv/config';
import { db, pool } from '../index';
import { users, providers, serviceCategories } from '../schema';
import { categoriesSeed } from './data/categories';
import { adminSeed } from './data/admin';
import { providersSeed } from './data/providers';
import { hashPassword } from '@/lib/auth';
import { eq, sql } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting KUFIX database seed...');

  // 1. Seed Service Categories
  console.log(`📦 Seeding ${categoriesSeed.length} service categories...`);
  for (const cat of categoriesSeed) {
    await db
      .insert(serviceCategories)
      .values({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        tone: cat.tone,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: serviceCategories.slug,
        set: {
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          tone: cat.tone,
          isActive: true,
        },
      });
  }
  console.log('✅ Service categories seeded.');

  // 2. Seed Administrator Account
  console.log(`👤 Seeding admin account: ${adminSeed.email}...`);
  const adminEmail = adminSeed.email.trim().toLowerCase();
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${adminEmail}`)
    .limit(1);

  if (existingAdmin) {
    await db
      .update(users)
      .set({
        name: adminSeed.name,
        phone: adminSeed.phone,
        location: adminSeed.location,
        role: 'admin',
        passwordHash: hashPassword(adminSeed.password),
        isSuspended: false,
      })
      .where(eq(users.id, existingAdmin.id));
    console.log('✅ Admin account updated.');
  } else {
    await db.insert(users).values({
      name: adminSeed.name,
      email: adminEmail,
      phone: adminSeed.phone,
      location: adminSeed.location,
      role: 'admin',
      passwordHash: hashPassword(adminSeed.password),
      isSuspended: false,
    });
    console.log('✅ Admin account created.');
  }

  // 3. Seed Verified Providers
  console.log(`🛠️ Seeding ${providersSeed.length} initial professional profiles...`);
  const defaultProviderPassword = hashPassword('KufixPro2026!');

  for (const item of providersSeed) {
    const providerEmail = item.userEmail.toLowerCase();
    let [userRow] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${providerEmail}`)
      .limit(1);

    if (!userRow) {
      [userRow] = await db
        .insert(users)
        .values({
          name: item.name,
          email: providerEmail,
          phone: item.phone,
          location: item.location,
          role: 'provider',
          passwordHash: defaultProviderPassword,
          isSuspended: false,
        })
        .returning();
    }

    const [existingProvider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, item.id))
      .limit(1);

    if (existingProvider) {
      await db
        .update(providers)
        .set({
          userId: userRow.id,
          name: item.name,
          category: item.category,
          location: item.location,
          area: item.area,
          bio: item.bio,
          experience: item.experience,
          avatar: item.avatar,
          verification: item.verification,
          available: item.available,
          isDemo: false,
        })
        .where(eq(providers.id, item.id));
    } else {
      await db.insert(providers).values({
        id: item.id,
        userId: userRow.id,
        name: item.name,
        category: item.category,
        location: item.location,
        area: item.area,
        bio: item.bio,
        experience: item.experience,
        avatar: item.avatar,
        verification: item.verification,
        available: item.available,
        isDemo: false,
      });
    }
  }
  console.log('✅ Initial providers seeded.');

  console.log('🎉 KUFIX database seed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
