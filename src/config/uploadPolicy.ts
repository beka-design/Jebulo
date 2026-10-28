/**
 * JEBULO - Product Upload Policy & File Validation
 * Enforces strict free-tier quotas, size constraints, and file signature security.
 */

// Quota & Size Constants (Bytes)
export const UPLOAD_LIMITS = {
  /** Maximum combined digital product deliverable payload per product (11 MiB) */
  MAX_COMBINED_PRODUCT_PAYLOAD_BYTES: 11 * 1024 * 1024, // 11,534,336 bytes

  /** Maximum individual product file size (never exceeds remaining allowance, max 11 MiB) */
  MAX_INDIVIDUAL_PRODUCT_FILE_BYTES: 11 * 1024 * 1024,

  /** Maximum cover image size (5 MiB) */
  MAX_COVER_IMAGE_BYTES: 5 * 1024 * 1024, // 5,242,880 bytes

  /** Maximum preview image size per asset (5 MiB) */
  MAX_PREVIEW_IMAGE_BYTES: 5 * 1024 * 1024, // 5,242,880 bytes

  /** Maximum number of public preview assets per product */
  MAX_PREVIEW_ASSETS_COUNT: 5,
} as const;

export interface FileTypeRule {
  extension: string;
  category: string;
  mime: string;
  /** Expected magic bytes at file offset 0 (hex string prefixes) */
  magicBytes?: string[];
  description: string;
}

/**
 * Allowed digital product deliverable types on JEBULO
 */
export const ALLOWED_PRODUCT_FILE_TYPES: Record<string, FileTypeRule> = {
  // Archives & Bundles
  zip: {
    extension: 'zip',
    category: 'archive',
    mime: 'application/zip',
    magicBytes: ['504B0304', '504B0506', '504B0708'], // PK..
    description: 'ZIP Archive',
  },
  // Publications & Documents
  pdf: {
    extension: 'pdf',
    category: 'document',
    mime: 'application/pdf',
    magicBytes: ['25504446'], // %PDF
    description: 'PDF Document / E-Book',
  },
  epub: {
    extension: 'epub',
    category: 'document',
    mime: 'application/epub+zip',
    magicBytes: ['504B0304'], // EPUB is a PK zip package
    description: 'EPUB E-Book',
  },
  // Audio & Music
  mp3: {
    extension: 'mp3',
    category: 'audio',
    mime: 'audio/mpeg',
    magicBytes: ['494433', 'FFF3', 'FFFB', 'FFF2'], // ID3 tag or MPEG sync word
    description: 'MP3 Audio',
  },
  wav: {
    extension: 'wav',
    category: 'audio',
    mime: 'audio/wav',
    magicBytes: ['52494646'], // RIFF....WAVE
    description: 'WAV Audio',
  },
  // Design, Templates & Spreadsheets
  json: {
    extension: 'json',
    category: 'data',
    mime: 'application/json',
    description: 'JSON Configuration / Data',
  },
  xlsx: {
    extension: 'xlsx',
    category: 'template',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    magicBytes: ['504B0304'], // OpenXML is a PK zip
    description: 'Excel Spreadsheet / Template',
  },
  csv: {
    extension: 'csv',
    category: 'data',
    mime: 'text/csv',
    description: 'CSV Data Sheet',
  },
  // Technical & CAD/BIM
  dwg: {
    extension: 'dwg',
    category: 'cad',
    mime: 'application/acad',
    magicBytes: ['41433130'], // AC10 (AutoCAD header)
    description: 'AutoCAD Drawing',
  },
  dxf: {
    extension: 'dxf',
    category: 'cad',
    mime: 'application/dxf',
    description: 'AutoCAD DXF File',
  },
  rvt: {
    extension: 'rvt',
    category: 'bim',
    mime: 'application/octet-stream',
    description: 'Autodesk Revit Project',
  },
};

/**
 * Blocked high-risk executable file signatures.
 * Any file starting with these signatures will be immediately rejected regardless of extension.
 */
export const DANGEROUS_EXECUTABLE_SIGNATURES: { name: string; hexPrefix: string }[] = [
  { name: 'Windows Executable / DLL', hexPrefix: '4D5A' }, // MZ
  { name: 'Linux Executable (ELF)', hexPrefix: '7F454C46' }, // \x7FELF
  { name: 'macOS Mach-O Binary', hexPrefix: 'FEEDFACE' },
  { name: 'macOS Mach-O 64-bit Binary', hexPrefix: 'FEEDFACF' },
  { name: 'Java Class Bytecode', hexPrefix: 'CAFEBABE' },
  { name: 'Shell Script / Batch Shebang', hexPrefix: '2321' }, // #!
];

/**
 * Cover and preview image types
 */
export const ALLOWED_IMAGE_TYPES: Record<string, FileTypeRule> = {
  jpg: {
    extension: 'jpg',
    category: 'image',
    mime: 'image/jpeg',
    magicBytes: ['FFD8FF'],
    description: 'JPEG Image',
  },
  jpeg: {
    extension: 'jpeg',
    category: 'image',
    mime: 'image/jpeg',
    magicBytes: ['FFD8FF'],
    description: 'JPEG Image',
  },
  png: {
    extension: 'png',
    category: 'image',
    mime: 'image/png',
    magicBytes: ['89504E470D0A1A0A'],
    description: 'PNG Image',
  },
  webp: {
    extension: 'webp',
    category: 'image',
    mime: 'image/webp',
    magicBytes: ['52494646'], // RIFF....WEBP
    description: 'WebP Image',
  },
};

/**
 * Converts ArrayBuffer bytes to uppercase hex string
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array, maxBytes = 16): string {
  const bytes = buffer instanceof Uint8Array ? buffer.slice(0, maxBytes) : new Uint8Array(buffer, 0, Math.min(buffer.byteLength, maxBytes));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorAm?: string;
  detectedType?: string;
}

/**
 * Validates a digital product deliverable file against JEBULO upload policy
 */
export function validateProductFile(
  file: { name: string; size: number },
  bufferHeader?: ArrayBuffer | Uint8Array,
  currentTotalPayloadBytes = 0
): ValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Check individual file size limit
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'The uploaded file is empty (0 bytes).',
      errorAm: 'የተሰቀለው ፋይል ባዶ ነው (0 ባይት)።',
    };
  }

  if (file.size > UPLOAD_LIMITS.MAX_INDIVIDUAL_PRODUCT_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMb} MiB) exceeds the maximum allowed product file limit of 11 MiB.`,
      errorAm: `የፋይሉ መጠን (${sizeMb} MiB) ከተፈቀደው ከፍተኛ የ11 MiB ገደብ በላይ ነው።`,
    };
  }

  // 2. Check combined product payload limit
  const projectedTotal = currentTotalPayloadBytes + file.size;
  if (projectedTotal > UPLOAD_LIMITS.MAX_COMBINED_PRODUCT_PAYLOAD_BYTES) {
    const projectedMb = (projectedTotal / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Total product files (${projectedMb} MiB) would exceed the maximum combined limit of 11 MiB.`,
      errorAm: `አጠቃላይ የፋይሎች መጠን (${projectedMb} MiB) ከተፈቀደው የ11 MiB ገደብ በላይ ይሆናል።`,
    };
  }

  // 3. Check allowed extension
  const rule = ALLOWED_PRODUCT_FILE_TYPES[ext];
  if (!rule) {
    const allowedList = Object.keys(ALLOWED_PRODUCT_FILE_TYPES).join(', .');
    return {
      valid: false,
      error: `File type ".${ext}" is not supported. Supported extensions: .${allowedList}. For multiple files, bundle into a .zip.`,
      errorAm: `የፋይል አይነት ".${ext}" አይደገፍም። የሚደገፉ አይነቶች: .${allowedList}። ብዙ ፋይሎችን በ .zip ያጠቃልሉ።`,
    };
  }

  // 4. File signature / Magic bytes check if buffer provided
  if (bufferHeader && bufferHeader.byteLength >= 4) {
    const hex = bufferToHex(bufferHeader, 8);

    // Block dangerous executables disguised as safe extensions
    for (const dangerous of DANGEROUS_EXECUTABLE_SIGNATURES) {
      if (hex.startsWith(dangerous.hexPrefix)) {
        return {
          valid: false,
          error: `Security violation: File contains executable signature (${dangerous.name}). Executable files are strictly prohibited.`,
          errorAm: `የደህንነት ጥሰት: ፋይሉ የአፈፃፀም ፕሮግራም ይዘት አለው። እንደነዚህ ያሉ ፋይሎች በጥብቅ የተከለከሉ ናቸው።`,
        };
      }
    }

    // Verify expected magic bytes if defined for this type
    if (rule.magicBytes && rule.magicBytes.length > 0) {
      const matchesMagic = rule.magicBytes.some((magic) => hex.startsWith(magic));
      if (!matchesMagic) {
        return {
          valid: false,
          error: `Corrupted or invalid file: The contents of "${file.name}" do not match a valid .${ext} structure.`,
          errorAm: `የተበላሸ ወይም ልክ ያልሆነ ፋይል: የ"${file.name}" ይዘት ከትክክለኛ .${ext} ቅርጸት ጋር አይዛመድም።`,
        };
      }
    }
  }

  return { valid: true, detectedType: rule.description };
}

/**
 * Validates a cover image file (max 5 MiB, JPG/PNG/WebP)
 */
export function validateCoverImage(
  file: { name: string; size: number },
  bufferHeader?: ArrayBuffer | Uint8Array
): ValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Image file is empty.',
      errorAm: 'የምስሉ ፋይል ባዶ ነው።',
    };
  }

  if (file.size > UPLOAD_LIMITS.MAX_COVER_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Cover image (${sizeMb} MiB) exceeds the maximum allowed limit of 5 MiB.`,
      errorAm: `የሽፋን ምስል መጠን (${sizeMb} MiB) ከተፈቀደው የ5 MiB ገደብ በላይ ነው።`,
    };
  }

  const rule = ALLOWED_IMAGE_TYPES[ext];
  if (!rule) {
    return {
      valid: false,
      error: `Image format ".${ext}" is not supported. Please use JPG, PNG, or WebP.`,
      errorAm: `የምስል ቅርጸት ".${ext}" አይደገፍም። እባክዎ JPG, PNG ወይም WebP ይጠቀሙ።`,
    };
  }

  if (bufferHeader && bufferHeader.byteLength >= 4) {
    const hex = bufferToHex(bufferHeader, 8);
    if (rule.magicBytes) {
      const matches = rule.magicBytes.some((magic) => hex.startsWith(magic));
      if (!matches) {
        return {
          valid: false,
          error: `Corrupted image: "${file.name}" does not match a valid ${ext.toUpperCase()} image signature.`,
          errorAm: `የተበላሸ ምስል: "${file.name}" ከትክክለኛ የ${ext.toUpperCase()} ምስል ፊርማ ጋር አይዛመድም።`,
        };
      }
    }
  }

  return { valid: true, detectedType: rule.description };
}
