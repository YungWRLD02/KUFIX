import { pgTable, uuid, varchar, text, timestamp, integer, numeric, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 180 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('customer'),
  location: varchar('location', { length: 180 }).notNull().default('Abuja'),
  isSuspended: boolean('is_suspended').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const serviceCategories = pgTable('service_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  description: varchar('description', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull().default('Wrench'),
  tone: varchar('tone', { length: 30 }).notNull().default('mint'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 180 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  location: varchar('location', { length: 180 }).notNull(),
  area: varchar('area', { length: 180 }).notNull().default('Abuja'),
  bio: text('bio').notNull(),
  experience: varchar('experience', { length: 80 }),
  avatar: text('avatar'),
  verification: varchar('verification', { length: 40 }).notNull().default('Not verified'),
  available: boolean('available').notNull().default(true),
  servicesOffered: varchar('services_offered', { length: 255 }).notNull().default(''),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  service: varchar('service', { length: 160 }).notNull(),
  description: text('description').notNull(),
  date: varchar('date', { length: 30 }).notNull(),
  time: varchar('time', { length: 30 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  instructions: text('instructions'),
  status: varchar('status', { length: 30 }).notNull().default('Pending'),
  price: numeric('price', { precision: 12, scale: 2 }),
  paymentStatus: varchar('payment_status', { length: 30 }).notNull().default('Unpaid'),
  providerConfirmed: boolean('provider_confirmed').notNull().default(false),
  customerConfirmed: boolean('customer_confirmed').notNull().default(false),
  escrowHeldAt: timestamp('escrow_held_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const quoteRequests = pgTable('quote_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description').notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Open'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => quoteRequests.id),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  details: text('details').notNull(),
  duration: varchar('duration', { length: 100 }),
  status: varchar('status', { length: 30 }).notNull().default('Submitted'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id).unique(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  hidden: boolean('hidden').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const supportRequests = pgTable('support_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 180 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  subject: varchar('subject', { length: 180 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Open'),
  response: text('response'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const jobPosts = pgTable('job_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  title: varchar('title', { length: 160 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description').notNull(),
  location: varchar('location', { length: 200 }).notNull(),
  budget: varchar('budget', { length: 60 }),
  urgency: varchar('urgency', { length: 30 }).notNull().default('Flexible'),
  status: varchar('status', { length: 30 }).notNull().default('Open'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const jobOffers = pgTable('job_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobPosts.id),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Submitted'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const workPosts = pgTable('work_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  title: varchar('title', { length: 160 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description').notNull(),
  location: varchar('location', { length: 200 }).notNull(),
  completedOn: varchar('completed_on', { length: 30 }).notNull(),
  imageUrl: text('image_url'),
  visible: boolean('visible').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chatThreads = pgTable('chat_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: varchar('kind', { length: 20 }).notNull().default('support'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  customerId: uuid('customer_id').references(() => users.id),
  providerId: uuid('provider_id').references(() => providers.id),
  subject: varchar('subject', { length: 180 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Open'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => chatThreads.id),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});


export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 8 }).notNull().default('NGN'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 30 }).notNull(), // deposit | escrow_hold | escrow_release | refund | withdrawal
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('completed'), // completed | pending | approved | rejected
  bookingId: uuid('booking_id').references(() => bookings.id),
  note: varchar('note', { length: 255 }),
  externalReference: varchar('external_reference', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  bankCode: varchar('bank_code', { length: 20 }).notNull().default(''),
  accountNumber: varchar('account_number', { length: 20 }).notNull(),
  paystackRecipientCode: varchar('paystack_recipient_code', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verificationDocuments = pgTable('verification_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  documentType: varchar('document_type', { length: 60 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'), // pending | approved | rejected | needs_info
  adminNote: text('admin_note'),
  reviewedById: uuid('reviewed_by_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const postLikes = pgTable('post_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  postType: varchar('post_type', { length: 20 }).notNull(), // 'work' | 'job'
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const postComments = pgTable('post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postType: varchar('post_type', { length: 20 }).notNull(), // 'work' | 'job'
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
