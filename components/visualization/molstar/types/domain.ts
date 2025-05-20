import { UUID } from 'molstar/lib/mol-util';

export interface Domain {
  id: string;
  chainId: string;
  start: number;
  end: number;
  color: string;
  label: string;
  description?: string;
  classification?: {
    t_group?: string;
    h_group?: string;
    x_group?: string;
    a_group?: string;
  };
}

export function createDomain(params: Partial<Domain> & { chainId: string; start: number; end: number }): Domain {
  return {
    id: UUID.create22(),
    chainId: params.chainId,
    start: params.start,
    end: params.end,
    color: params.color || getRandomColor(),
    label: params.label || `Domain ${params.start}-${params.end}`,
    description: params.description,
    classification: params.classification
  };
}

export function getRandomColor(): string {
  // Generate domain-friendly colors
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 60%)`;
}

export function getDomainBoundaries(residueIndices: number[], chainId: string): { chainId: string; start: number; end: number } | undefined {
  if (!residueIndices.length) return undefined;
  
  // Sort indices to get proper range
  residueIndices.sort((a, b) => a - b);
  
  return {
    chainId,
    start: residueIndices[0],
    end: residueIndices[residueIndices.length - 1]
  };
}
