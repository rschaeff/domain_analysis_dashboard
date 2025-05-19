// Domain analysis types
export interface DomainSummary {
  id: number;
  protein_id: number;
  pdb_id: string;
  chain_id: string;
  batch_id: number | null;
  reference_version: string | null;
  timestamp: Date;
  domain_number: number;
  domain_id: string | null;
  start_pos: number;
  end_pos: number;
  range: string;
  source: string | null;
  source_id: string | null;
  confidence: number | null;
  t_group: string | null;
  h_group: string | null;
  x_group: string | null;
  a_group: string | null;
  evidence_count: number;
  evidence_types: string;
}

export interface DomainEvidence {
  id: number;
  domain_id: number;
  evidence_type: string;
  source_id: string | null;
  domain_ref_id: string | null;
  hit_id: string | null;
  pdb_id: string | null;
  chain_id: string | null;
  confidence: number | null;
  probability: number | null;
  evalue: number | null;
  score: number | null;
  hsp_count: number | null;
  is_discontinuous: boolean;
  t_group: string | null;
  h_group: string | null;
  x_group: string | null;
  a_group: string | null;
  query_range: string | null;
  hit_range: string | null;
  created_at: Date;
}

export interface DomainComparison {
  id: number;
  partition_domain_id: number;
  reference_type: string;
  reference_domain_id: string | null;
  reference_domain_range: string | null;
  jaccard_similarity: number | null;
  overlap_residues: number | null;
  union_residues: number | null;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  t_group_match: boolean;
  h_group_match: boolean;
  x_group_match: boolean;
  a_group_match: boolean;
  created_at: Date;
}

export interface ProteinOverview {
  id: number;
  pdb_id: string;
  chain_id: string;
  batch_id: number | null;
  sequence_length: number;
  coverage: number;
  residues_assigned: number;
  domains_with_evidence: number;
  fully_classified_domains: number;
  domain_count: number;
  reference_version: string | null;
  is_classified: boolean;
}

export interface DomainModification {
  id: number;
  protein_id: number;
  domain_id: number | null;
  modification_type: ModificationType;
  original_start: number | null;
  original_end: number | null;
  new_start: number | null;
  new_end: number | null;
  original_classification: string | null;
  new_classification: string | null;
  reason: string | null;
  created_by: string;
  created_at: Date;
  applied: boolean;
}

export type ModificationType = 
  | 'boundary_edit'
  | 'reassignment' 
  | 'split'
  | 'merge'
  | 'create'
  | 'delete';

export type ClassificationLevel = 't_group' | 'h_group' | 'x_group' | 'a_group';

export type EvidenceType = 'blast' | 'hhsearch' | 'profile' | 'structure' | 'manual';

// Filter types
export interface DomainFilters {
  pdb_id?: string;
  chain_id?: string;
  t_group?: string[];
  h_group?: string[];
  x_group?: string[];
  a_group?: string[];
  min_confidence?: number;
  max_confidence?: number;
  evidence_types?: EvidenceType[];
  has_reference?: boolean;
  batch_ids?: number[];
  sequence_length_min?: number;
  sequence_length_max?: number;
}

export interface PaginationParams {
  page: number;
  size: number;
  total?: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationParams;
  error?: string;
}

export interface DomainListResponse {
  domains: DomainSummary[];
  total: number;
  page: number;
  size: number;
}

// Visualization types
export interface BoundaryVisualization {
  protein_length: number;
  putative_domains: Array<{
    start: number;
    end: number;
    confidence: number;
    classification: string;
  }>;
  reference_domains: Array<{
    start: number;
    end: number;
    classification: string;
    source: string;
  }>;
  overlaps: Array<{
    start: number;
    end: number;
    type: 'exact' | 'partial' | 'conflict';
  }>;
}

// Mol* integration types (placeholder)
export interface MolStarViewerProps {
  pdb_id: string;
  chain_id: string;
  domains?: Array<{
    start: number;
    end: number;
    color: string;
    label: string;
  }>;
  onDomainClick?: (domain: any) => void;
}

// EBI Nightingale integration types (placeholder)
export interface NightingaleViewerProps {
  protein_id: string;
  sequence: string;
  domains?: Array<{
    start: number;
    end: number;
    label: string;
    color: string;
  }>;
  features?: Array<{
    start: number;
    end: number;
    type: string;
    description: string;
  }>;
}
