import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/**
 * scrypt parameters. N=2^14 / r=8 / p=1 is the OWASP-acceptable baseline for
 * interactive logins (~16 MB memory per hash) without an external dependency.
 */
const PARAMS = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Encoded form: `scrypt$N$r$p$<saltB64>$<hashB64>` — self-describing so parameters can be raised later. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, PARAMS);

  return [
    'scrypt',
    String(PARAMS.N),
    String(PARAMS.r),
    String(PARAMS.p),
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Constant-time verification. Returns false — never throws — on a malformed
 * digest, so a corrupted row reads as "wrong password", not a 500.
 */
export async function verifyPassword(plain: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const expected = Buffer.from(hashB64 ?? '', 'base64');
  const salt = Buffer.from(saltB64 ?? '', 'base64');

  if (expected.length === 0 || salt.length === 0) {
    return false;
  }

  const derived = await scryptAsync(plain, salt, expected.length, { N, r, p });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * A syntactically valid digest of an unguessable value. Used to burn comparable
 * CPU time when the email is unknown, so response timing does not reveal which
 * accounts exist.
 */
export const DUMMY_DIGEST =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
