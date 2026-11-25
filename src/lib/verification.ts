import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '@/db';
import { providers, verificationDocuments } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';

export const DOCUMENT_TYPES = [
  { type: 'national-id', label: 'National ID Card', level: 'Identity checked' },
  { type: 'passport', label: 'International Passport', level: 'Identity checked' },
  { type: 'drivers-license', label: 'Driver\'s License', level: 'Identity checked' },
  { type: 'nin-slip', label: 'National Identification Number (NIN) Slip', level: 'Identity checked' },
  { type: 'cac', label: 'CAC Business Registration Document', level: 'Business/profile reviewed' },
  { type: 'utility-bill', label: 'Utility Bill (address proof)', level: 'Business/profile reviewed' },
  { type: 'certificate', label: 'Professional Certificate / Licensed Trade Document', level: 'Professional credentials checked' },
] as const;

export type VerificationDocumentType = (typeof DOCUMENT_TYPES)[number]['type'];
export function levelForDocument(type: string) { return DOCUMENT_TYPES.find(d => d.type === type)?.level || 'Identity checked'; }

const ALLOWED = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
  'application/pdf': ['pdf'],
} as const;

export function validateDocumentFile(name: string, size: number, mimeType: string) {
  if (size > 5 * 1024 * 1024) return `File is too large (max 5 MB)`;
  const extOk = Object.values(ALLOWED).some((extensions) => Array.from(extensions as readonly string[]).includes(name.split('.').pop()?.toLowerCase() || ''));
  const mimeOk = (Object.keys(ALLOWED) as string[]).includes(mimeType) || mimeType === '';
  if (!extOk && !mimeOk) return 'Only JPEG, PNG, WebP, HEIC or PDF documents are accepted';
  return null;
}

export async function storeDocument(providerId: string, documentType: string, originalName: string, buffer: Buffer, mimeType: string) {
  if (!DOCUMENT_TYPES.some(d => d.type === documentType)) throw new Error('Unknown document type');
  const extension = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase().slice(0, 10) : 'bin';
  const stored = `${crypto.randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), 'private', 'uploads', 'verification');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, stored), buffer);
  const [row] = await db.insert(verificationDocuments).values({ providerId, documentType, fileName: originalName.slice(0, 255), filePath: stored, mimeType: mimeType || 'application/octet-stream', fileSize: buffer.length }).returning();
  return row;
}

export async function getDocumentFile(id: string) {
  const [doc] = await db.select().from(verificationDocuments).where(eq(verificationDocuments.id, id)).limit(1);
  if (!doc) return null;
  const [provider] = await db.select().from(providers).where(eq(providers.id, doc.providerId)).limit(1);
  const filePath = path.join(process.cwd(), 'private', 'uploads', 'verification', doc.filePath);
  const buffer = await fs.readFile(filePath).catch(() => null);
  return { doc, provider, file: buffer };
}

export async function latestLevelFor(providerId: string) {
  const approved = await db.select().from(verificationDocuments).where(and(eq(verificationDocuments.providerId, providerId), eq(verificationDocuments.status, 'approved'))).orderBy(desc(verificationDocuments.createdAt)).limit(10);
  if (!approved.length) return null;
  const levels = approved.map(d => levelForDocument(d.documentType));
  const order = ['Phone verified', 'Identity checked', 'Business/profile reviewed', 'Professional credentials checked'];
  let best = levels.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
  return best;
}

export async function loadProviderDocuments(providerId: string) {
  return db.select().from(verificationDocuments).where(eq(verificationDocuments.providerId, providerId)).orderBy(desc(verificationDocuments.createdAt));
}

export async function loadPendingDocuments() {
  const rows = await db.select().from(verificationDocuments).where(eq(verificationDocuments.status, 'pending')).orderBy(desc(verificationDocuments.createdAt)).limit(50);
  const providerRows = await db.select().from(providers);
  return rows.map(doc => ({ ...doc, provider: providerRows.find(p => p.id === doc.providerId) }));
}
