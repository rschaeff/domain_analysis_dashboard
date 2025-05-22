// lib/types.ts - Complete type definitions
export interface DomainSummary {
  id: number
  protein_id: number
  pdb_id: string
  chain_id: string
  batch_id: number
  reference_version: string
  timestamp: string
  domain_number: number
  domain_id: string
  start_pos: number
  end_pos: number
  range: string
  source: string
  source_id: string
  confidence: number | null
  t_group: string | null
  h_group: string | null
  x_group: string | null
  a_group: string | null
  evidence_count: number
  evidence_types: string
}

export interface PaginationParams {
  page: number
  size: number
  total: number
  totalPages?: number
}

export interface DomainFilters {
  pdb_id?: string
  chain_id?: string
  t_group?: string[]
  h_group?: string[]
  x_group?: string[]
  a_group?: string[]
  min_confidence?: number
  max_confidence?: number
  sequence_length_min?: number
  sequence_length_max?: number
}

// Add other required types
export interface DomainEvidence {
  id: number
  domain_id: number
  evidence_type: string
  source_id: string
  domain_ref_id?: string
  hit_id?: string
  pdb_id?: string
  chain_id?: string
  confidence?: number
  probability?: number
  evalue?: number
  score?: number
  hsp_count?: number
  is_discontinuous?: boolean
  t_group?: string
  h_group?: string
  x_group?: string
  a_group?: string
  query_range?: string
  hit_range?: string
  created_at: string
}

export interface DomainComparison {
  id: number
  partition_domain_id: number
  reference_type: string
  reference_domain_id: string
  reference_domain_range: string
  jaccard_similarity?: number
  overlap_residues?: number
  union_residues?: number
  precision?: number
  recall?: number
  f1_score?: number
  t_group_match?: boolean
  h_group_match?: boolean
  x_group_match?: boolean
  a_group_match?: boolean
  created_at: string
}

export interface ProteinOverview {
  id: number
  pdb_id: string
  chain_id: string
  batch_id?: number
  reference_version?: string
  domain_count: number
  sequence_length: number
  fully_classified_domains: number
  coverage: number
  domains_with_evidence: number
  residues_assigned: number
  is_classified: boolean
}

// Visualization types
export interface NightingaleViewerProps {
  protein_id: string
  sequence?: string
  domains?: Array<{
    start: number
    end: number
    label: string
    color: string
  }>
  features?: Array<{
    start: number
    end: number
    type: string
    description: string
  }>
}

// Add or update this interface in your types.ts file
export interface MolStarViewerProps {
  pdb_id: string;
  chain_id?: string;
  domains?: Array<{
    start: number;
    end: number;
    label?: string;
    color?: string;
  }>;
  onDomainClick?: (domain: any) => void;
}

export interface HitValidation {
  hit: any
  evidence_type: 'chain_blast' | 'domain_blast' | 'hhsearch'
  validation_results: {
    sequence_indexing: 'valid' | 'suspect' | 'invalid'
    query_coverage: number
    reference_coverage: number | null
    coverage_quality: 'excellent' | 'good' | 'poor' | 'fragment'
    is_usable_for_boundaries: boolean
  }
  issues: ValidationIssue[]
  boundary_impact: {
    would_create_fragment: boolean
    boundary_quality: 'reliable' | 'questionable' | 'poor'
    recommended_action: string
  }
}

export interface ValidationIssue {
  type: 'indexing' | 'coverage' | 'significance' | 'boundary'
  severity: 'critical' | 'warning' | 'info'
  message: string
  suggestion: string
}
