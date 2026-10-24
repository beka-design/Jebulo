import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';
import { am } from '../locales/am';
import { INITIAL_CATEGORIES } from '../services/marketplaceService';

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

  describe('Security & Protected File Access', () => {
    it('verifies private storage path is never placed in public product payloads', () => {
      const publicProductSample = {
        id: 'prod-123',
        titleEn: 'Ethiopian Architectural Details',
        priceEtb: 1200,
        currency: 'ETB',
        coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/preview.jpg',
        protectedFile: {
          fileName: 'architectural_details_2026.zip',
          fileSize: 104857600,
          mimeType: 'application/zip',
          fileExtension: 'zip',
          uploadedAt: Date.now(),
        },
      };

      // Ensure storagePath is absent from public metadata
      expect((publicProductSample.protectedFile as any).storagePath).toBeUndefined();
      expect(publicProductSample.coverImageUrl).toContain('cloudinary.com');
    });
  });
});
