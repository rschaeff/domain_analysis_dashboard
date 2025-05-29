// lib/types.ts - Complete updated types with curation filters

export interface DomainFilters {
  // Basic protein filters
  pdb_id?: string
  chain_id?: string
  domain_number?: number
  batch_id?: number

  // ECOD classification filters
  t_group?: string[]
  h_group?: string[]
  x_group?: string[]
  a_group?: string[]

  // Quality and confidence filters
  min_confidence?: number
  max_confidence?: number

  // Sequence filters
  sequence_length_min?: number
  sequence_length_max?: number

  // Evidence filters
  min_evidence_count?: number
  evidence_types?: string

  // NEW: Curation decision filters
  has_curation_decision?: boolean
  curation_status?: string[]
  curation_decision_type?: string[]
  curator_name?: string
  curation_date_from?: string
  curation_date_to?: string
  flagged_for_review?: boolean
  needs_review?: boolean
}

export interface PaginationParams {
  page: number
  size: number
  total: number
}

export interface ProteinSummary {
  id: string
  pdb_id: string
  chain_id: string
  source_id: string
  sequence_length: number
  batch_id: number
  reference_version: string
  is_classified: boolean
  processing_date: string
  days_old: number
  is_recent: boolean

  // Domain summary
  domain_count: number
  domains_classified: number
  domains_unclassified: number
  avg_confidence: number
  best_confidence: number
  coverage: number
  confidence_level: 'high' | 'medium' | 'low'
  residues_assigned: number
  classification_status: string

  // Evidence summary
  total_evidence_count: number
  evidence_types: string
  evidence_quality: string
  has_chain_blast: boolean
  has_domain_blast: boolean
  has_hhsearch: boolean
  chain_blast_evidence: number
  domain_blast_evidence: number
  hhsearch_evidence: number

  // NEW: Curation-related fields
  has_curation_decision: boolean
  curation_decision_id?: number
  decision_type?: string
  curation_status?: string
  curator_name?: string
  decision_date?: string
  flagged_for_review: boolean
  needs_review: boolean
  curation_confidence?: number
  curation_notes?: string

  // Metadata
  data_source: string
  architecture: string
}

export interface Domain {
  id: number
  domain_id: string
  start_pos: number
  end_pos: number
  range: string
  source: string
  source_id: string
  confidence: number

  // Classification
  t_group?: string
  h_group?: string
  x_group?: string
  a_group?: string
  t_group_name?: string
  h_group_name?: string
  x_group_name?: string

  // Properties
  is_manual_rep: boolean
  is_f70: boolean
  is_f40: boolean
  is_f99: boolean
  length: number

  // Evidence
  evidence: DomainEvidence[]
  evidence_count: number
}

export interface DomainEvidence {
  domain_id: number
  evidence_type: string
  source_id: string
  domain_ref_id?: string
  hit_id?: string
  pdb_id?: string
  chain_id?: string
  confidence: number
  probability?: number
  evalue?: number
  score?: number
  hsp_count?: number
  is_discontinuous: boolean

  // Reference classification
  ref_t_group?: string
  ref_h_group?: string
  ref_x_group?: string
  ref_a_group?: string
  ref_t_group_name?: string
  ref_h_group_name?: string
  ref_x_group_name?: string

  // Ranges
  query_range?: string
  hit_range?: string

  // Metadata
  domain_evidence_count: number
}

export interface Protein {
  id: number
  pdb_id: string
  chain_id: string
  source_id: string
  unp_acc?: string
  name?: string
  type?: string
  tax_id?: number
  sequence_length: number
  created_at: string
  updated_at: string

  // Domain statistics
  domain_count: number
  fully_classified_domains: number
  domains_with_evidence: number
  coverage: number
  residues_assigned: number
  is_classified: boolean

  // Batch and reference information
  batch_id?: number
  reference_version?: string
  processing_date?: string

  // Quality metrics
  avg_confidence: number
  best_confidence: number

  // NEW: Curation information
  has_curation_decision: boolean
  curation_decision_id?: number
  decision_type?: string
  curation_status?: string
  curator_name?: string
  decision_date?: string
  flagged_for_review: boolean
  needs_review: boolean
  curation_confidence?: number
  curation_notes?: string

  // Domains
  putative_domains: Domain[]
  reference_domains: Domain[]
  all_domains: Domain[]
}

export interface CurationDecision {
  id: number
  protein_id: number
  decision_type: string
  status: string
  curator_name: string
  decision_date: string
  flagged_for_review: boolean
  needs_review: boolean
  confidence_level?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface CurationSession {
  id: number
  curator_name: string
  session_start: string
  session_end?: string
  is_active: boolean
  batch_size: number
  proteins_reviewed: number
  decisions_made: number
  session_notes?: string
}

export interface ArchitectureGroup {
  architecture_id: string
  pattern_name: string
  domain_count: number
  t_groups: string[]
  frequency: number
  avg_confidence: number
  classification_completeness: number
  proteins: ProteinSummary[]
}

export interface FilterOption {
  value: string
  label: string
  count: number
  description?: string
}

export interface ApiResponse<T> {
  data: T
  pagination?: PaginationParams
  statistics?: any
  sorting?: any
  filters?: any
  metadata?: any
  error?: string
}
