/**
 * JEBULO - Server-Side Product Upload Policy & Validation
 * Enforces 11 MiB cumulative deliverable limit, extension allowlist,
 * and dangerous executable blocking on the trusted Cloudflare Worker.
 */

export const UPLOAD_LIMITS = {
  /** Maximum combined digital deliverable payload per product (11 MiB) */
  MAX_COMBINED_PRODUCT_PAYLOAD_BYTES: 11 * 1024 * 1024, // 11,534,336 bytes

  /** Maximum individual deliverable file size (11 MiB) */
  MAX_INDIVIDUAL_PRODUCT_FILE_BYTES: 11 * 1024 * 1024,

  /** Maximum cover image size (5 MiB) */
  MAX_COVER_IMAGE_BYTES: 5 * 1024 * 1024,

  /** Maximum preview image size per asset (5 MiB) */
  MAX_PREVIEW_IMAGE_BYTES: 5 * 1024 * 1024,
} as const;

export const ALLOWED_PRODUCT_EXTENSIONS = new Set([
  'zip',
  'pdf',
  'epub',
  'mp3',
  'wav',
  'json',
  'xlsx',
  'csv',
  'dwg',
  'dxf',
  'rvt',
]);

export const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'sh',
  'bash',
  'bat',
  'cmd',
  'ps1',
  'vbs',
  'scr',
  'pif',
  'com',
  'msi',
  'jar',
  'apk',
  'app',
]);

export interface ServerUploadValidationResult {
  valid: boolean;
  error?: string;
  extension?: string;
}

/**
 * Validates a product file upload request on the server
 */
export function validateServerUploadRequest(params: {
  fileName: string;
  fileSizeBytes: number;
  mimeType?: string;
  existingTotalBytes?: number;
}): ServerUploadValidationResult {
  const { fileName, fileSizeBytes, existingTotalBytes = 0 } = params;

  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'Invalid or missing file name.' };
  }

  // Prevent path traversal in file names
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return { valid: false, error: 'File name contains invalid path traversal characters.' };
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!ext || ext === fileName.toLowerCase()) {
    return { valid: false, error: 'File must have a valid extension (e.g. .zip, .pdf).' };
  }

  // Explicitly block dangerous executables
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Security violation: File extension ".${ext}" is an executable or script and is strictly prohibited.`,
    };
  }

  // Check allowlist
  if (!ALLOWED_PRODUCT_EXTENSIONS.has(ext)) {
    const allowed = Array.from(ALLOWED_PRODUCT_EXTENSIONS).join(', .');
    return {
      valid: false,
      error: `File extension ".${ext}" is not supported. Supported extensions: .${allowed}. For multiple files, package into a .zip.`,
    };
  }

  // Validate file size bounds
  if (typeof fileSizeBytes !== 'number' || isNaN(fileSizeBytes) || fileSizeBytes <= 0) {
    return { valid: false, error: 'Invalid file size. Size must be greater than 0 bytes.' };
  }

  if (fileSizeBytes > UPLOAD_LIMITS.MAX_INDIVIDUAL_PRODUCT_FILE_BYTES) {
    const mb = (fileSizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${mb} MiB) exceeds the maximum allowed product file limit of 11 MiB.`,
    };
  }

  // Enforce cumulative combined product deliverable limit
  const projectedTotal = existingTotalBytes + fileSizeBytes;
  if (projectedTotal > UPLOAD_LIMITS.MAX_COMBINED_PRODUCT_PAYLOAD_BYTES) {
    const projectedMb = (projectedTotal / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Total product files (${projectedMb} MiB) would exceed the maximum combined limit of 11 MiB per product.`,
    };
  }

  return { valid: true, extension: ext };
}
