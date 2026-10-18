import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { storage } from '../lib/firebase';
import { ProductFileMetadata } from '../types';

export const storageService = {
  /**
   * Upload public media (cover image or previews)
   * If Cloudinary environment variables are present, upload to Cloudinary;
   * otherwise upload to Firebase Storage 'public/' path.
   */
  async uploadPublicAsset(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    // Use Cloudinary if configured and not default placeholder
    if (cloudName && uploadPreset && cloudName !== 'gizay-demo') {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'gizay_public_previews');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.secure_url;
    }

    // Fallback to Firebase Storage public assets path
    const fileExt = file.name.split('.').pop() || '';
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const storageRef = ref(storage, `public/assets/${safeName}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000',
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    });
  },

  /**
   * Upload protected paid product file.
   * Stored in the private bucket path 'protected/products/{productId}/{fileName}'.
   * NEVER gives a public download URL!
   */
  async uploadProtectedProductFile(
    productId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<ProductFileMetadata> {
    // Validate file size (250MB limit by default)
    const MAX_SIZE = 250 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds the maximum allowed size of 250MB.');
    }

    const fileExt = file.name.split('.').pop() || '';
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const privateStoragePath = `protected/products/${productId}/${Date.now()}_${safeFileName}`;
    const storageRef = ref(storage, privateStoragePath);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        productId,
        originalName: file.name,
        uploadedAt: Date.now().toString(),
      },
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        () => {
          // Return metadata ONLY (no public download URL!)
          resolve({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            fileExtension: fileExt.toLowerCase(),
            storagePath: privateStoragePath,
            uploadedAt: Date.now(),
          });
        }
      );
    });
  },
};
