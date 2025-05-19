// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 500

// Domain boundary thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.2,
} as const

export const OVERLAP_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.1,
} as const

// Classification groups
export const CLASSIFICATION_LEVELS = [
  't_group',
  'h_group', 
  'x_group',
  'a_group'
] as const

// Evidence types
export const EVIDENCE_TYPES = [
  'blast',
  'hhsearch',
  'profile',
  'structure',
  'manual'
] as const

// Visualization settings
export const DOMAIN_COLORS = {
  putative: '#3b82f6',
  reference: '#ef4444',
  overlap: '#8b5cf6',
  conflict: '#f59e0b',
} as const

// Mol* viewer configuration
export const MOLSTAR_CONFIG = {
  // Placeholder for Mol* configuration
  url: 'https://molstar.org/viewer/',
  defaultRepresentation: 'cartoon',
  highlightColor: '#ff6b6b',
} as const

// EBI Nightingale configuration  
export const NIGHTINGALE_CONFIG = {
  // Placeholder for EBI Nightingale configuration
  apiUrl: 'https://www.ebi.ac.uk/proteins/api/',
  trackTypes: ['domain', 'secondary-structure', 'topology'],
} as const
