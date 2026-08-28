import { promises as fs } from "fs";
import path from "path";
import { getWorkerEnv } from "@/lib/cf-env";

const DATA_DIR = path.join(process.cwd(), ".data");

export function uploadsDir(): string {
  return path.join(DATA_DIR, "uploads");
}

export function testamentUploadsDir(): string {
  return path.join(uploadsDir(), "testaments");
}

export function advocateUploadsDir(): string {
  return path.join(uploadsDir(), "advocate-apps");
}

export function elderSignupUploadsDir(): string {
  return path.join(uploadsDir(), "elder-signup");
}

export function bindersDir(): string {
  return path.join(uploadsDir(), "binders");
}

/** Turn a stored path (R2 key, relative, or leftover absolute disk path) into an object key. */
export function blobKey(stored: string): string {
  const normalized = stored.replace(/\\/g, "/").trim();
  const markers = [".data/uploads/", "/uploads/"];
  for (const marker of markers) {
    const at = normalized.indexOf(marker);
    if (at >= 0) return normalized.slice(at + marker.length);
  }
  if (path.isAbsolute(normalized)) return path.basename(normalized);
  return normalized.replace(/^\.\//, "");
}

export function isUnsafeBlobKey(stored: string): boolean {
  const key = blobKey(stored);
  return !key || key.includes("..") || key.startsWith("/") || key.includes("\\");
}

function contentTypeFor(key: string, fallback?: string): string {
  if (fallback) return fallback;
  const ext = path.extname(key).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webm") return "audio/webm";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function diskPath(key: string): Promise<string> {
  const full = path.join(uploadsDir(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  return full;
}

export async function writeStoredFile(
  key: string,
  bytes: Uint8Array,
  contentType?: string,
): Promise<string> {
  const objectKey = blobKey(key);
  if (isUnsafeBlobKey(objectKey)) {
    throw new Error("Invalid upload path.");
  }
  const env = await getWorkerEnv();
  if (env.UPLOADS) {
    await env.UPLOADS.put(objectKey, bytes, {
      httpMetadata: { contentType: contentTypeFor(objectKey, contentType) },
    });
    return objectKey;
  }
  const full = await diskPath(objectKey);
  await fs.writeFile(full, bytes);
  return objectKey;
}

export async function readStoredFile(stored: string): Promise<Buffer | null> {
  const key = blobKey(stored);
  if (isUnsafeBlobKey(key)) return null;
  const env = await getWorkerEnv();
  if (env.UPLOADS) {
    const object = await env.UPLOADS.get(key);
    if (!object) return null;
    return Buffer.from(await object.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(uploadsDir(), key));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(stored: string): Promise<void> {
  const key = blobKey(stored);
  if (isUnsafeBlobKey(key)) return;
  const env = await getWorkerEnv();
  if (env.UPLOADS) {
    await env.UPLOADS.delete(key);
    return;
  }
  try {
    await fs.unlink(path.join(uploadsDir(), key));
  } catch {
    // Missing file is not an error after the DB row is gone.
  }
}
