/**
 * JEBULO - Cloudflare Worker Firebase ID Token Verification
 * Uses native Web Crypto API (crypto.subtle) without heavy Node.js dependencies.
 */

import { AuthUser, Env } from './types';

interface JwkKey {
  kty: string;
  alg: string;
  use: string;
  kid: string;
  n: string;
  e: string;
}

interface JwksResponse {
  keys: JwkKey[];
}

// In-memory cache for Google's public JWKS in the Worker isolate
let cachedKeys: Record<string, CryptoKey> = {};
let cachedKeysExpiry = 0;

/**
 * Base64URL decode helper
 */
function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeJson<T = any>(str: string): T {
  const bytes = base64UrlDecode(str);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

/**
 * Fetches Google's public JWKs for Firebase Authentication
 */
async function getGooglePublicCryptoKey(kid: string): Promise<CryptoKey | null> {
  const now = Date.now();

  // If cached and not expired
  if (cachedKeys[kid] && now < cachedKeysExpiry) {
    return cachedKeys[kid];
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) {
      console.error('Failed to fetch Google JWKS:', res.statusText);
      return null;
    }

    // Cache header check (usually 6 hours)
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 21600;
    cachedKeysExpiry = now + maxAgeSeconds * 1000;

    const data: JwksResponse = await res.json();
    cachedKeys = {};

    for (const key of data.keys) {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        {
          kty: key.kty,
          alg: key.alg,
          n: key.n,
          e: key.e,
        },
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['verify']
      );
      cachedKeys[key.kid] = cryptoKey;
    }

    return cachedKeys[kid] || null;
  } catch (err) {
    console.error('Error importing Google JWKS:', err);
    return null;
  }
}

/**
 * Verifies a Firebase Authentication ID Token
 */
export async function verifyFirebaseIdToken(
  token: string,
  env: Env
): Promise<{ valid: boolean; user?: AuthUser; error?: string }> {
  if (!token) {
    return { valid: false, error: 'Authorization token missing.' };
  }

  // Development/Test mock token support for local testing without internet connection
  if (env.ENVIRONMENT !== 'production' && token.startsWith('mock-')) {
    const parts = token.split('-'); // e.g. mock-user123-creator
    return {
      valid: true,
      user: {
        uid: parts[1] || 'mock-user',
        email: `${parts[1] || 'mock-user'}@example.com`,
        role: (parts[2] as any) || 'buyer',
        creator: parts[2] === 'creator' || parts[2] === 'admin',
        admin: parts[2] === 'admin',
      },
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT format.' };
  }

  try {
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = base64UrlDecodeJson<{ alg: string; kid: string; typ: string }>(headerB64);
    const payload = base64UrlDecodeJson<{
      iss: string;
      aud: string;
      auth_time: number;
      sub: string;
      iat: number;
      exp: number;
      email?: string;
      admin?: boolean;
      creator?: boolean;
      role?: string;
    }>(payloadB64);

    if (header.alg !== 'RS256' || !header.kid) {
      return { valid: false, error: 'Invalid token header algorithm or missing key ID.' };
    }

    // Standard Firebase claims validation
    const nowSec = Math.floor(Date.now() / 1000);
    const projectId = env.FIREBASE_PROJECT_ID;

    if (payload.exp < nowSec) {
      return { valid: false, error: 'Token has expired.' };
    }

    if (payload.iat > nowSec + 300) {
      return { valid: false, error: 'Token issued in the future.' };
    }

    if (payload.aud !== projectId) {
      return { valid: false, error: `Invalid audience. Expected "${projectId}", got "${payload.aud}".` };
    }

    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      return { valid: false, error: `Invalid issuer. Expected "${expectedIssuer}", got "${payload.iss}".` };
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      return { valid: false, error: 'Invalid or missing user identifier (sub).' };
    }

    // Fetch and verify public key
    const publicKey = await getGooglePublicCryptoKey(header.kid);
    if (!publicKey) {
      return { valid: false, error: 'Unable to verify token against Google public certificates.' };
    }

    const signatureBytes = base64UrlDecode(signatureB64);
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const isSignatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      dataBytes
    );

    if (!isSignatureValid) {
      return { valid: false, error: 'Cryptographic signature verification failed.' };
    }

    const authUser: AuthUser = {
      uid: payload.sub,
      email: payload.email,
      admin: !!payload.admin || payload.role === 'admin',
      creator: !!payload.creator || payload.role === 'creator' || !!payload.admin,
      role: (payload.role as any) || (payload.admin ? 'admin' : payload.creator ? 'creator' : 'buyer'),
    };

    return { valid: true, user: authUser };
  } catch (err: any) {
    return { valid: false, error: `Token verification error: ${err.message}` };
  }
}
