import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getExtension(mimeType: string, filename: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'png') return 'png';
  if (ext === 'webp') return 'webp';
  return 'bin';
}

function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }
  // WebP: RIFF ... WEBP
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') return true;
  return false;
}

export async function savePublicUpload(
  file: File | null | undefined,
  subfolder: 'work' | 'avatars'
): Promise<{ url: string | null; error?: string }> {
  if (!file || typeof file === 'string' || !file.size) {
    return { url: null };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { url: null, error: 'Image must be under 5 MB.' };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { url: null, error: 'Only JPEG, PNG, or WebP images are permitted.' };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!validateImageMagicBytes(buffer)) {
    return { url: null, error: 'File contents do not match a valid image format.' };
  }

  const ext = getExtension(file.type, file.name || '');
  const filename = `${crypto.randomUUID()}.${ext}`;
  const targetDir = path.join(process.cwd(), 'public', 'uploads', subfolder);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), buffer);

  return { url: `/uploads/${subfolder}/${filename}` };
}
