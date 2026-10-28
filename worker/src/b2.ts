/**
 * JEBULO - Backblaze B2 Private Storage Service
 * Handles restricted direct-upload and temporary download authorizations.
 *
 * Backblaze B2 Security & Architecture Notes:
 * 1. B2 Native Upload URLs:
 *    - In B2 Native API (`b2_get_upload_url`), upload tokens are issued at the B2 bucket level,
 *      and are valid for up to 24 hours. The B2 service does NOT bind native upload tokens to a single file.
 *    - To enforce upload security, JEBULO applies multiple server-side defenses:
 *      a) Product existence, creator ownership, and product status ('DRAFT' | 'PENDING_REVIEW')
 *         must be verified on the server before an upload URL is issued.
 *      b) Server-controlled object naming enforces the namespace: `protected/products/${productId}/${timestamp}_${safeName}`.
 *      c) In `upload-complete`, the server strictly validates that the object path belongs to the creator's
 *         product and directly queries B2 (`b2_list_file_names`) to verify the file exists and obtain its
 *         true byte size directly from B2, rejecting client claims.
 * 2. Downloads:
 *    - Download tokens are scoped to the exact object prefix and expire after 15 minutes (900s).
 */

import { Env } from './types';

interface B2AuthCache {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  expiresAt: number;
}

let cachedB2Auth: B2AuthCache | null = null;

/**
 * Authenticates with Backblaze B2 Native API
 */
async function authorizeB2Account(env: Env): Promise<B2AuthCache> {
  const now = Date.now();
  if (cachedB2Auth && now < cachedB2Auth.expiresAt) {
    return cachedB2Auth;
  }

  const keyId = env.B2_APPLICATION_KEY_ID;
  const appKey = env.B2_APPLICATION_KEY;

  if (!keyId || !appKey) {
    throw new Error('Backblaze B2 credentials (B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY) are not configured.');
  }

  const basicAuth = btoa(`${keyId}:${appKey}`);
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backblaze B2 authorization failed (${response.status}): ${errorText}`);
  }

  const data = await response.json<{
    apiUrl: string;
    downloadUrl: string;
    authorizationToken: string;
  }>();

  // B2 auth tokens typically last 24 hours; cache for 12 hours for safety
  cachedB2Auth = {
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    authorizationToken: data.authorizationToken,
    expiresAt: now + 12 * 60 * 60 * 1000,
  };

  return cachedB2Auth;
}

export interface B2UploadAuthResponse {
  uploadUrl: string;
  authorizationToken: string;
  storagePath: string;
  headers: Record<string, string>;
  isSimulated?: boolean;
}

/**
 * Obtains an upload URL and token from Backblaze B2 for uploading a product file.
 * The browser uploads directly to B2 using the returned upload URL.
 */
export async function getB2UploadAuthorization(
  env: Env,
  params: {
    productId: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  }
): Promise<B2UploadAuthResponse> {
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `protected/products/${params.productId}/${timestamp}_${safeName}`;

  // If in development/test and B2 credentials are unset, provide simulated upload authorization
  if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY) {
    if (env.ENVIRONMENT === 'production') {
      throw new Error('Production environment requires configured Backblaze B2 credentials.');
    }
    return {
      uploadUrl: `/api/products/simulated-upload?path=${encodeURIComponent(storagePath)}`,
      authorizationToken: 'simulated-b2-upload-token-' + timestamp,
      storagePath,
      headers: {
        'X-Bz-File-Name': storagePath,
        'Content-Type': params.mimeType || 'application/octet-stream',
      },
      isSimulated: true,
    };
  }

  const auth = await authorizeB2Account(env);
  const bucketId = env.B2_BUCKET_ID;

  if (!bucketId) {
    throw new Error('B2_BUCKET_ID is missing from Worker environment configuration.');
  }

  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain B2 upload URL (${res.status}): ${errorText}`);
  }

  const uploadData = await res.json<{
    uploadUrl: string;
    authorizationToken: string;
  }>();

  return {
    uploadUrl: uploadData.uploadUrl,
    authorizationToken: uploadData.authorizationToken,
    storagePath,
    headers: {
      Authorization: uploadData.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(storagePath),
      'Content-Type': params.mimeType || 'application/octet-stream',
      'X-Bz-Content-Sha1': 'do_not_verify', // Client computes or bypasses raw SHA-1 header
    },
  };
}

export interface B2VerifiedFileInfo {
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  fileId?: string;
  uploadTimestamp?: number;
}

/**
 * Queries Backblaze B2 to verify that an uploaded object exists and retrieves its true size.
 * Rejects client-supplied sizes and claims.
 */
export async function verifyB2File(
  env: Env,
  storagePath: string
): Promise<B2VerifiedFileInfo> {
  // Development / fallback simulation mode
  if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY) {
    if (env.ENVIRONMENT === 'production') {
      throw new Error('Production environment requires configured Backblaze B2 credentials.');
    }
    // In dev simulation, accept path if valid format and return simulated 1 MiB size
    if (storagePath && storagePath.startsWith('protected/products/')) {
      return {
        exists: true,
        contentLength: 1024 * 1024, // 1 MiB simulated verified size
        contentType: 'application/octet-stream',
        fileId: 'sim-b2-file-' + Date.now(),
        uploadTimestamp: Date.now(),
      };
    }
    return { exists: false };
  }

  const auth = await authorizeB2Account(env);
  const bucketId = env.B2_BUCKET_ID;

  if (!bucketId) {
    throw new Error('B2_BUCKET_ID is missing from environment.');
  }

  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      startFileName: storagePath,
      maxFileCount: 1,
      prefix: storagePath,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`B2 list file names error (${res.status}): ${errorText}`);
    return { exists: false };
  }

  const data = await res.json<{
    files?: Array<{
      fileName: string;
      contentLength: number;
      contentType: string;
      fileId: string;
      uploadTimestamp: number;
    }>;
  }>();

  if (data.files && data.files.length > 0) {
    const file = data.files[0];
    if (file.fileName === storagePath) {
      return {
        exists: true,
        contentLength: file.contentLength,
        contentType: file.contentType,
        fileId: file.fileId,
        uploadTimestamp: file.uploadTimestamp,
      };
    }
  }

  return { exists: false };
}

export interface B2DownloadAuthResponse {
  downloadUrl: string;
  fileName: string;
  expiresInSeconds: number;
  isSimulated?: boolean;
}

/**
 * Obtains a temporary, short-lived download URL (valid for 15 minutes)
 * restricted to the specific product file path.
 */
export async function getB2DownloadAuthorization(
  env: Env,
  params: {
    storagePath: string;
    fileName: string;
  }
): Promise<B2DownloadAuthResponse> {
  const validDurationSeconds = 15 * 60; // 15 minutes

  // Development fallback if B2 credentials unset
  if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY) {
    if (env.ENVIRONMENT === 'production') {
      throw new Error('Production environment requires configured Backblaze B2 credentials.');
    }
    return {
      downloadUrl: `/api/products/simulated-download?path=${encodeURIComponent(params.storagePath)}&fileName=${encodeURIComponent(params.fileName)}`,
      fileName: params.fileName,
      expiresInSeconds: validDurationSeconds,
      isSimulated: true,
    };
  }

  const auth = await authorizeB2Account(env);
  const bucketId = env.B2_BUCKET_ID;
  const bucketName = env.B2_BUCKET_NAME;

  if (!bucketId || !bucketName) {
    throw new Error('B2_BUCKET_ID or B2_BUCKET_NAME is missing from configuration.');
  }

  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix: params.storagePath,
      validDurationInSeconds: validDurationSeconds,
      b2ContentDisposition: `attachment; filename="${encodeURIComponent(params.fileName)}"`,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain B2 download authorization (${res.status}): ${errorText}`);
  }

  const downloadAuth = await res.json<{ authorizationToken: string }>();

  // Full restricted URL with download authorization token
  const fullDownloadUrl = `${auth.downloadUrl}/file/${bucketName}/${params.storagePath}?Authorization=${encodeURIComponent(
    downloadAuth.authorizationToken
  )}&b2ContentDisposition=${encodeURIComponent(`attachment; filename="${params.fileName}"`)}`;

  return {
    downloadUrl: fullDownloadUrl,
    fileName: params.fileName,
    expiresInSeconds: validDurationSeconds,
  };
}
