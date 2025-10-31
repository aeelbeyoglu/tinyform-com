/**
 * Password hashing utilities using Web Crypto API
 * Compatible with Cloudflare Workers
 */

// Generate a random salt
function generateSalt(): Uint8Array {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return salt;
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex string to ArrayBuffer
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Hash password using PBKDF2
async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256 // 32 bytes
  );
}

/**
 * Hash a password with a salt
 * Returns a string in format: salt:hash:iterations
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const iterations = 100000;
  const hash = await pbkdf2(password, salt, iterations);

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(hash);

  return `${saltHex}:${hashHex}:${iterations}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const [saltHex, hashHex, iterationsStr] = hashedPassword.split(':');
    if (!saltHex || !hashHex || !iterationsStr) {
      return false;
    }

    const salt = hexToBuffer(saltHex);
    const iterations = parseInt(iterationsStr, 10);
    const hash = await pbkdf2(password, salt, iterations);
    const hashHexComputed = bufferToHex(hash);

    // Constant-time comparison
    if (hashHex.length !== hashHexComputed.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < hashHex.length; i++) {
      result |= hashHex.charCodeAt(i) ^ hashHexComputed.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Check if a password meets minimum requirements
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}