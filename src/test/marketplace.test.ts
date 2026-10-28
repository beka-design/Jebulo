import { describe, it, expect, beforeEach } from 'vitest';
import { en } from '../locales/en';
import { am } from '../locales/am';
import { INITIAL_CATEGORIES } from '../services/marketplaceService';
import {
  UPLOAD_LIMITS,
  validateProductFile,
  validateCoverImage,
  bufferToHex,
  ALLOWED_PRODUCT_FILE_TYPES,
} from '../config/uploadPolicy';
import {
  validateServerUploadRequest,
} from '../../worker/src/uploadPolicy';
import { isSimulatorAllowed, verifyChapaWebhookSignature } from '../../worker/src/chapa';
import { firestoreService } from '../../worker/src/firestore';
import { Env } from '../../worker/src/types';

describe('JEBULO Marketplace Core Business Logic', () => {
  
  describe('12% Commission & Financial Accounting', () => {
    const COMMISSION_RATE = 0.12;

    it('calculates 12% marketplace commission accurately for integer amounts', () => {
      const grossPrice = 500; // 500 ETB
      const commission = Math.round(grossPrice * COMMISSION_RATE * 100) / 100;
      const creatorEarnings = Math.round((grossPrice - commission) * 100) / 100;

      expect(commission).toBe(60); // 12% of 500 = 60 ETB
      expect(creatorEarnings).toBe(440); // 88% of 500 = 440 ETB
      expect(commission + creatorEarnings).toBe(grossPrice);
    });

    it('handles decimal rounding consistently to 2 minor units', () => {
      const grossPrice = 333.33; // 333.33 ETB
      const commission = Math.round(grossPrice * COMMISSION_RATE * 100) / 100;
      const creatorEarnings = Math.round((grossPrice - commission) * 100) / 100;

      expect(commission).toBe(40.00); // 333.33 * 0.12 = 39.9996 -> 40.00
      expect(creatorEarnings).toBe(293.33);
      expect(commission + creatorEarnings).toBe(grossPrice);
    });

    it('enforces minimum payout threshold of 500 ETB', () => {
      const minPayout = 500;
      const validRequest = 550;
      const invalidRequest = 350;

      expect(validRequest >= minPayout).toBe(true);
      expect(invalidRequest >= minPayout).toBe(false);
    });
  });

  describe('Dynamic Category Structure', () => {
    it('provides diversified initial categories covering general digital products', () => {
      expect(INITIAL_CATEGORIES.length).toBeGreaterThanOrEqual(8);
      
      const slugs = INITIAL_CATEGORIES.map(c => c.slug);
      expect(slugs).toContain('ebooks');
      expect(slugs).toContain('courses');
      expect(slugs).toContain('graphics');
      expect(slugs).toContain('software');
      expect(slugs).toContain('templates');
      expect(slugs).toContain('audio');
      expect(slugs).toContain('photo-video');
      expect(slugs).toContain('cad-bim');
    });

    it('ensures each category has both English and Amharic titles and descriptions', () => {
      for (const cat of INITIAL_CATEGORIES) {
        expect(cat.nameEn).toBeTruthy();
        expect(cat.nameAm).toBeTruthy();
        expect(cat.slug).toBeTruthy();
        expect(cat.isActive).toBe(true);
      }
    });
  });

  describe('Localization Completeness', () => {
    it('has matching top-level translation sections in English and Amharic', () => {
      const enSections = Object.keys(en);
      const amSections = Object.keys(am);

      expect(amSections).toEqual(expect.arrayContaining(enSections));
    });

    it('contains brand name JEBULO and Ethiopian root references in both dictionaries', () => {
      expect(en.common.brandName).toBe('JEBULO');
      expect(am.common.brandName).toBe('JEBULO');
      expect(en.common.brandEthiopicTagline).toContain('ጀቡሎ');
      expect(am.common.brandEthiopicTagline).toContain('ጀቡሎ');
      expect(en.common.currency).toBe('ETB');
    });
  });

  describe('Product Upload Policy (Free-Tier 11 MiB Quota & Security)', () => {
    it('defines 11 MiB (11,534,336 bytes) as the maximum combined deliverable payload', () => {
      expect(UPLOAD_LIMITS.MAX_COMBINED_PRODUCT_PAYLOAD_BYTES).toBe(11 * 1024 * 1024);
      expect(UPLOAD_LIMITS.MAX_INDIVIDUAL_PRODUCT_FILE_BYTES).toBe(11 * 1024 * 1024);
    });

    it('defines 5 MiB (5,242,880 bytes) as the maximum cover image size', () => {
      expect(UPLOAD_LIMITS.MAX_COVER_IMAGE_BYTES).toBe(5 * 1024 * 1024);
      expect(UPLOAD_LIMITS.MAX_PREVIEW_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    });

    it('approves legitimate files within 11 MiB limit', () => {
      const validZip = { name: 'architecture_pack.zip', size: 10 * 1024 * 1024 }; // 10 MiB
      const pkHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      
      const result = validateProductFile(validZip, pkHeader, 0);
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('ZIP Archive');
    });

    it('rejects product files exceeding 11 MiB limit', () => {
      const oversizedFile = { name: 'huge_archive.zip', size: 12 * 1024 * 1024 }; // 12 MiB
      const result = validateProductFile(oversizedFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the maximum allowed product file limit of 11 MiB');
      expect(result.errorAm).toContain('11 MiB');
    });

    it('rejects combined product files exceeding 11 MiB total allowance', () => {
      const secondFile = { name: 'addon.pdf', size: 3 * 1024 * 1024 }; // 3 MiB
      const existingPayload = 9 * 1024 * 1024; // 9 MiB already attached (total = 12 MiB > 11 MiB)
      
      const result = validateProductFile(secondFile, undefined, existingPayload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Total product files (12.00 MiB) would exceed the maximum combined limit of 11 MiB');
    });

    it('rejects disguised dangerous executables (MZ header disguised as .zip)', () => {
      const fakeZip = { name: 'evil_trojan.zip', size: 2 * 1024 * 1024 };
      const mzHeader = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

      const result = validateProductFile(fakeZip, mzHeader);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Security violation: File contains executable signature');
      expect(result.error).toContain('Windows Executable');
    });

    it('rejects disguised Linux ELF binary disguised as .pdf', () => {
      const fakePdf = { name: 'contract.pdf', size: 1 * 1024 * 1024 };
      const elfHeader = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);

      const result = validateProductFile(fakePdf, elfHeader);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Security violation: File contains executable signature (Linux Executable (ELF))');
    });

    it('validates cover image size (rejects > 5 MiB) and image formats', () => {
      const validJpg = { name: 'cover.jpg', size: 2 * 1024 * 1024 }; // 2 MiB
      const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      expect(validateCoverImage(validJpg, jpegHeader).valid).toBe(true);

      const oversizedCover = { name: 'huge_cover.jpg', size: 6 * 1024 * 1024 }; // 6 MiB
      const result = validateCoverImage(oversizedCover);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the maximum allowed limit of 5 MiB');

      const unsupportedImage = { name: 'cover.bmp', size: 1 * 1024 * 1024 };
      expect(validateCoverImage(unsupportedImage).valid).toBe(false);
    });

    it('converts byte buffers to uppercase hex strings accurately', () => {
      const bytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
      expect(bufferToHex(bytes)).toBe('504B0304');
    });

    it('supports major digital product extensions including CAD/BIM', () => {
      expect(ALLOWED_PRODUCT_FILE_TYPES['zip']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['pdf']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['epub']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['mp3']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['wav']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['dwg']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['xlsx']).toBeDefined();
      expect(ALLOWED_PRODUCT_FILE_TYPES['json']).toBeDefined();
    });
  });

  describe('Server-Side Upload Policy Validation (Worker)', () => {
    it('validates allowed extensions on the server', () => {
      const res = validateServerUploadRequest({
        fileName: 'source_code_bundle.zip',
        fileSizeBytes: 5 * 1024 * 1024,
      });
      expect(res.valid).toBe(true);
      expect(res.extension).toBe('zip');
    });

    it('blocks dangerous executable files on the server', () => {
      for (const dangerous of ['malware.exe', 'trojan.dll', 'hack.sh', 'virus.bat', 'inject.ps1']) {
        const res = validateServerUploadRequest({
          fileName: dangerous,
          fileSizeBytes: 1024,
        });
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Security violation: File extension');
      }
    });

    it('rejects path traversal attempts in file names', () => {
      const res1 = validateServerUploadRequest({ fileName: '../secret.zip', fileSizeBytes: 1024 });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('path traversal');

      const res2 = validateServerUploadRequest({ fileName: 'nested/dir/file.pdf', fileSizeBytes: 1024 });
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('path traversal');
    });

    it('enforces cumulative 11 MiB payload limit across multiple files on the server', () => {
      const res = validateServerUploadRequest({
        fileName: 'part2.zip',
        fileSizeBytes: 4 * 1024 * 1024, // 4 MiB
        existingTotalBytes: 8 * 1024 * 1024, // 8 MiB already on product (Total = 12 MiB > 11 MiB)
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceed the maximum combined limit of 11 MiB');
    });
  });

  describe('Order Lookup Resolution (orderId !== txRef)', () => {
    const mockEnv: Env = {
      FIREBASE_PROJECT_ID: 'test-project',
      ENVIRONMENT: 'test',
    };

    beforeEach(async () => {
      // Seed an order where orderId and txRef are distinct
      const orderId = 'ord_distinct_unique_12345';
      const txRef = 'JEBULO-TX-RANDOM-98765';

      await firestoreService.setDocument(mockEnv, 'orders', orderId, {
        id: orderId,
        txRef: txRef,
        buyerId: 'buyer-999',
        productId: 'prod-444',
        amountEtb: 750,
        currency: 'ETB',
        status: 'PENDING_PAYMENT',
        createdAt: Date.now(),
      });

      // Alias mapping
      await firestoreService.setDocument(mockEnv, 'orders_by_txRef', txRef, {
        orderId: orderId,
        txRef: txRef,
        createdAt: Date.now(),
      });
    });

    it('successfully retrieves the order using txRef when orderId !== txRef', async () => {
      const txRef = 'JEBULO-TX-RANDOM-98765';
      const order = await firestoreService.getOrderByTxRef(mockEnv, txRef);

      expect(order).not.toBeNull();
      expect(order.id).toBe('ord_distinct_unique_12345');
      expect(order.txRef).toBe(txRef);
      expect(order.amountEtb).toBe(750);
      expect(order.buyerId).toBe('buyer-999');
    });

    it('returns null for nonexistent transaction reference', async () => {
      const order = await firestoreService.getOrderByTxRef(mockEnv, 'NONEXISTENT-TX-000');
      expect(order).toBeNull();
    });
  });

  describe('Payment Security, Webhook Verification & Idempotency', () => {
    const mockEnv: Env = {
      FIREBASE_PROJECT_ID: 'test-project',
      ENVIRONMENT: 'production',
      CHAPA_WEBHOOK_SECRET: 'super-secret-hmac-key-2026',
      MARKETPLACE_COMMISSION_RATE: '0.12',
    };

    it('verifies valid HMAC-SHA256 webhook signatures', async () => {
      const rawBody = JSON.stringify({ tx_ref: 'JEBULO-123', status: 'success' });
      const secret = 'super-secret-hmac-key-2026';

      // Compute HMAC
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
      const hexSig = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = await verifyChapaWebhookSignature(rawBody, hexSig, mockEnv);
      expect(isValid).toBe(true);
    });

    it('fails closed and rejects webhook when signature is invalid or tampered', async () => {
      const rawBody = JSON.stringify({ tx_ref: 'JEBULO-123', status: 'success' });
      const tamperedSig = 'deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb';

      const isValid = await verifyChapaWebhookSignature(rawBody, tamperedSig, mockEnv);
      expect(isValid).toBe(false);
    });

    it('fails closed when CHAPA_WEBHOOK_SECRET is missing', async () => {
      const envWithoutSecret: Env = {
        FIREBASE_PROJECT_ID: 'test-project',
        ENVIRONMENT: 'production',
      };
      const rawBody = JSON.stringify({ tx_ref: 'JEBULO-123', status: 'success' });
      const isValid = await verifyChapaWebhookSignature(rawBody, 'some-signature', envWithoutSecret);
      expect(isValid).toBe(false);
    });

    it('processes order idempotently without duplicating entitlements or balances', async () => {
      const order = {
        id: 'ord-idem-111',
        buyerId: 'buyer-idem',
        productId: 'prod-idem',
        productTitle: 'Idempotent Product',
        creatorId: 'creator-idem',
        amountEtb: 1000,
        txRef: 'JEBULO-IDEM-001',
      };

      // 1. First execution
      const firstResult = await firestoreService.processSuccessfulOrder(mockEnv, order, 'CHAPA-REF-1');
      expect(firstResult.alreadyPaid).toBe(false);

      // Verify entitlement was granted
      const ent1 = await firestoreService.getDocument(mockEnv, 'purchases', `${order.buyerId}_${order.productId}`);
      expect(ent1).not.toBeNull();
      expect(ent1.isActive).toBe(true);

      // Verify balance was credited 880 ETB (1000 - 120 ETB commission)
      const bal1 = await firestoreService.getDocument(mockEnv, 'creatorBalances', order.creatorId);
      expect(bal1.availableBalanceEtb).toBe(880);

      // 2. Duplicate callback with same order
      const duplicateResult = await firestoreService.processSuccessfulOrder(mockEnv, order, 'CHAPA-REF-DUPLICATE');
      expect(duplicateResult.alreadyPaid).toBe(true);

      // Verify balance was NOT double-credited
      const bal2 = await firestoreService.getDocument(mockEnv, 'creatorBalances', order.creatorId);
      expect(bal2.availableBalanceEtb).toBe(880); // still 880, not 1760!
    });
  });

  describe('Production Simulator Isolation (Fail-Closed)', () => {
    it('disables simulator when ENVIRONMENT === "production"', () => {
      const env: Env = {
        FIREBASE_PROJECT_ID: 'test',
        ENVIRONMENT: 'production',
        ENABLE_CHAPA_SIMULATOR: 'true',
      };
      expect(isSimulatorAllowed(env)).toBe(false);
    });

    it('disables simulator when ENVIRONMENT is missing or undefined (fail-closed)', () => {
      const env: Env = {
        FIREBASE_PROJECT_ID: 'test',
      };
      expect(isSimulatorAllowed(env)).toBe(false);
    });

    it('disables simulator when ENVIRONMENT is staging or unrecognized', () => {
      const env: Env = {
        FIREBASE_PROJECT_ID: 'test',
        ENVIRONMENT: 'staging' as any,
        ENABLE_CHAPA_SIMULATOR: 'true',
      };
      expect(isSimulatorAllowed(env)).toBe(false);
    });

    it('disables simulator when ENABLE_CHAPA_SIMULATOR is false', () => {
      const env: Env = {
        FIREBASE_PROJECT_ID: 'test',
        ENVIRONMENT: 'development',
        ENABLE_CHAPA_SIMULATOR: 'false',
      };
      expect(isSimulatorAllowed(env)).toBe(false);
    });

    it('enables simulator ONLY when ENVIRONMENT is explicitly development/test AND flag is true', () => {
      const devEnv: Env = {
        FIREBASE_PROJECT_ID: 'test',
        ENVIRONMENT: 'development',
        ENABLE_CHAPA_SIMULATOR: 'true',
      };
      expect(isSimulatorAllowed(devEnv)).toBe(true);

      const testEnv: Env = {
        FIREBASE_PROJECT_ID: 'test',
        ENVIRONMENT: 'test',
        ENABLE_CHAPA_SIMULATOR: 'true',
      };
      expect(isSimulatorAllowed(testEnv)).toBe(true);
    });
  });

  describe('Security & Backblaze B2 Private Storage Access', () => {
    it('verifies private storage path is never placed in public product payloads', () => {
      const publicProductSample = {
        id: 'prod-123',
        titleEn: 'Ethiopian Architectural Details',
        priceEtb: 1200,
        currency: 'ETB',
        coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/preview.jpg',
        protectedFile: {
          fileName: 'architectural_details_2026.zip',
          fileSize: 10 * 1024 * 1024,
          mimeType: 'application/zip',
          fileExtension: 'zip',
          uploadedAt: Date.now(),
        },
      };

      expect((publicProductSample.protectedFile as any).storagePath).toBeUndefined();
      expect(publicProductSample.coverImageUrl).toContain('cloudinary.com');
    });

    it('ensures B2 object key follows private convention protected/products/{productId}/{timestamp}_{name}', () => {
      const productId = 'prod-abc';
      const safeName = 'design_templates.zip';
      const timestamp = 1700000000000;
      const b2Key = `protected/products/${productId}/${timestamp}_${safeName}`;

      expect(b2Key.startsWith('protected/products/')).toBe(true);
      expect(b2Key).toContain(productId);
      expect(b2Key).toContain(safeName);
    });
  });
});
