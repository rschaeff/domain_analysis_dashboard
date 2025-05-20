/**
 * Helper module for dealing with structure format detection
 */

// Known formats supported by Molstar
export const SupportedFormats = {
  PDB: 'pdb',
  MMCIF: 'mmcif',
  SDF: 'sdf',
  MOL: 'mol',
  MOL2: 'mol2',
  MMTF: 'mmtf',
};

/**
 * Detect format based on file content
 */
export function detectFormatFromContent(firstBytes: string): string | undefined {
  // Check for common format signatures
  if (firstBytes.includes('HEADER') || firstBytes.includes('ATOM  ') || firstBytes.includes('HETATM')) {
    return SupportedFormats.PDB;
  }
  
  if (firstBytes.includes('data_') || firstBytes.includes('loop_')) {
    return SupportedFormats.MMCIF;
  }
  
  if (firstBytes.includes('$$$$') || firstBytes.includes('M  END')) {
    return SupportedFormats.SDF;
  }
  
  return undefined;
}

/**
 * Detect format from content type header
 */
export function detectFormatFromContentType(contentType: string): string | undefined {
  contentType = contentType.toLowerCase();
  
  if (contentType.includes('pdb') || contentType.includes('x-pdb')) {
    return SupportedFormats.PDB;
  }
  
  if (contentType.includes('mmcif') || contentType.includes('cif')) {
    return SupportedFormats.MMCIF;
  }
  
  if (contentType.includes('sdf') || contentType.includes('mol')) {
    return SupportedFormats.SDF;
  }
  
  return undefined;
}

/**
 * Create a safe format string that Molstar will accept
 */
export function getValidFormatName(formatName?: string): string {
  // Default to mmCIF if format is unknown
  if (!formatName) return SupportedFormats.MMCIF;
  
  const format = formatName.toLowerCase();
  
  // Map to known formats
  if (format === 'cif' || format.includes('mmcif')) {
    return SupportedFormats.MMCIF;
  }
  
  if (format === 'pdb' || format.includes('pdb')) {
    return SupportedFormats.PDB;
  }
  
  // For other formats, return as is
  return format;
}

/**
 * Get file extension for a given format
 */
export function getFileExtension(format: string): string {
  const validFormat = getValidFormatName(format);
  
  switch (validFormat) {
    case SupportedFormats.MMCIF:
      return 'cif';
    case SupportedFormats.PDB:
      return 'pdb';
    case SupportedFormats.SDF:
      return 'sdf';
    case SupportedFormats.MOL:
      return 'mol';
    case SupportedFormats.MOL2:
      return 'mol2';
    case SupportedFormats.MMTF:
      return 'mmtf';
    default:
      return validFormat;
  }
}
