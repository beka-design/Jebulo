/**
 * JEBULO - Hybrid Storage Service
 * Handles:
 * 1. Public promotional media & previews -> Cloudinary (free tier) with fallback
 * 2. Protected digital product deliverables -> Private Backblaze B2 bucket
 *    via restricted direct browser uploads (11 MiB limit, magic byte validation)
 */

import { ProductFileMetadata } from '../types';
import {
  validateProductFile,
  validateCoverImage,
  UPLOAD_LIMITS,
} from '../config/uploadPolicy';
import { apiClient } from './apiClient';

/**
 * Reads the first 16 bytes of a File to inspect magic bytes / file signature
 */
async function readFileHeaderBytes(file: File, numBytes = 16): Promise<Uint8Array> {
  const slice = file.slice(0, numBytes);
  const arrayBuffer = await slice.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export const storageService = {
  /**
   * Upload public media (cover image or previews)
   * Validates 5 MiB size limit and image magic bytes.
   * If Cloudinary environment variables are present, upload to Cloudinary;
   * otherwise fallback to local/storage preview handler.
   */
  async uploadPublicAsset(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    // 1. Validate cover/preview image
    const headerBytes = await readFileHeaderBytes(file, 8);
    const validation = validateCoverImage(file, headerBytes);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    // Use Cloudinary if configured and not default placeholder
    if (cloudName && uploadPreset && cloudName !== 'gizay-demo') {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'jebulo_public_previews');

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } else {
            reject(new Error(`Cloudinary upload failed (${xhr.status}): ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error uploading image to Cloudinary.'));
        xhr.send(formData);
      });
    }

    // Local / development fallback: creates an object URL or mock CDN URL
    if (onProgress) onProgress(100);
    return URL.createObjectURL(file);
  },

  /**
   * Upload protected paid product file to private Backblaze B2 bucket.
   * Direct browser upload:
   * 1. Validates 11 MiB payload limit and magic bytes.
   * 2. Requests restricted B2 upload authorization from backend.
   * 3. Uploads binary directly to B2 (bypassing Worker).
   * 4. Notifies backend to record verified metadata.
   */
  async uploadProtectedProductFile(
    productId: string,
    file: File,
    onProgress?: (percent: number) => void,
    currentTotalProductBytes = 0
  ): Promise<ProductFileMetadata> {
    // 1. Read file header bytes for signature inspection
    const headerBytes = await readFileHeaderBytes(file, 16);

    // 2. Validate against 11 MiB combined limit and dangerous executables
    const validation = validateProductFile(file, headerBytes, currentTotalProductBytes);
    if (!validation.valid) {
      throw new Error(validation.error || 'Product file validation failed.');
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    // 3. Request restricted B2 upload authorization from Worker
    const authData = await apiClient.requestUploadAuthorization({
      productId,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
    });

    // 4. Direct Browser Upload to B2 (or simulated dev endpoint)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', authData.uploadUrl);

      // Set B2-required headers
      for (const [headerKey, headerVal] of Object.entries(authData.headers)) {
        xhr.setRequestHeader(headerKey, headerVal);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Backblaze B2 upload failed with HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during direct B2 upload.'));
      xhr.send(file);
    });

    // 5. Complete upload registration on backend
    await apiClient.completeUpload({
      productId,
      fileName: file.name,
      storagePath: authData.storagePath,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      fileExtension: fileExt,
    });

    return {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      fileExtension: fileExt,
      storagePath: authData.storagePath,
      uploadedAt: Date.now(),
    };
  },

  /**
   * Max limits reference
   */
  limits: UPLOAD_LIMITS,
};
