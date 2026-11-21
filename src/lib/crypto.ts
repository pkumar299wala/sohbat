function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export async function hashGuptMantra(mantra: string): Promise<string> {
  const clean = mantra.trim();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(saltBytes);
  const digest = await sha256Hex(`${saltHex}:${clean}`);
  return `${saltHex}:${digest}`;
}

export async function verifyGuptMantra(mantra: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, expectedHex] = storedHash.split(':');
  if (!saltHex || !expectedHex) return false;
  const actualHex = await sha256Hex(`${saltHex}:${mantra.trim()}`);
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = crypto.getRandomValues(new Uint8Array(4));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[random[i] % chars.length];
  }
  return `SOHBAT-${suffix}`;
}

export function normalizeRoomCode(input: string): string {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('SOHBAT-')) return trimmed;
  return `SOHBAT-${trimmed}`;
}

export function generateSafeId(prefix = 'id'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const random = bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
  return `${cleanPrefix}_${random}`;
}
