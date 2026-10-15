import { randomBytes, scrypt as derive, pbkdf2 as derivePbkdf2, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
const scrypt = promisify(derive);
const pbkdf2 = promisify(derivePbkdf2);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await pbkdf2(password, salt, 600000, 32, 'sha256');
  return `pbkdf2_sha256:600000:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) {
    const [, salt, expected] = hash.split(':');
    return timingSafeEqual(await scrypt(password, salt, 64) as Buffer, Buffer.from(expected, 'hex'));
  }
  if (!/^pbkdf2_sha256:600000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash)) return false;
  const [, , salt, expected] = hash.split(':');
  return timingSafeEqual(await pbkdf2(password, salt, 600000, 32, 'sha256'), Buffer.from(expected, 'hex'));
}
