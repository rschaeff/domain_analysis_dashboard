// Navigation utilities for consistent URL handling

export interface ProteinIdentifier {
  id?: number
  pdb_id: string
  chain_id: string
  source_id?: string
}

export interface DomainIdentifier {
  id: number | string
}

/**
 * Generate protein URL using source_id format (pdb_id_chain_id)
 */
export function getProteinUrl(protein: ProteinIdentifier): string {
  // Prefer source_id if available, otherwise construct from pdb_id and chain_id
  const sourceId = protein.source_id || `${protein.pdb_id}_${protein.chain_id}`
  return `/protein/${sourceId}`
}

/**
 * Generate domain URL using domain ID
 */
export function getDomainUrl(domain: DomainIdentifier): string {
  return `/domains/${domain.id}`
}

/**
 * Parse protein ID from URL parameter
 * Returns null if the format is invalid
 */
export function parseProteinId(id: string): { 
  pdb_id: string; 
  chain_id: string; 
  isNumeric: boolean 
} | null {
  // Try parsing as source_id format (e.g., "1914_A")
  const sourceMatch = id.match(/^([a-zA-Z0-9]{4})_([a-zA-Z])$/)
  if (sourceMatch) {
    return {
      pdb_id: sourceMatch[1],
      chain_id: sourceMatch[2],
      isNumeric: false
    }
  }
  
  // Check if it's a numeric ID (fallback)
  if (/^\d+$/.test(id)) {
    return {
      pdb_id: '', // Not available from numeric ID
      chain_id: '', // Not available from numeric ID
      isNumeric: true
    }
  }
  
  return null
}

/**
 * Construct source_id from pdb_id and chain_id
 */
export function constructSourceId(pdb_id: string, chain_id: string): string {
  return `${pdb_id}_${chain_id}`
}

/**
 * Extract pdb_id and chain_id from source_id
 */
export function parseSourceId(source_id: string): { pdb_id: string; chain_id: string } | null {
  const parts = source_id.split('_')
  if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 1) {
    return {
      pdb_id: parts[0],
      chain_id: parts[1]
    }
  }
  return null
}

/**
 * Validate protein ID format
 */
export function isValidProteinId(id: string): boolean {
  return parseProteinId(id) !== null
}

/**
 * Navigation helper for React Router
 */
export class NavigationHelper {
  private router: any

  constructor(router: any) {
    this.router = router
  }

  /**
   * Navigate to protein details page
   */
  toProtein(protein: ProteinIdentifier): void {
    this.router.push(getProteinUrl(protein))
  }

  /**
   * Navigate to domain details page
   */
  toDomain(domain: DomainIdentifier): void {
    this.router.push(getDomainUrl(domain))
  }

  /**
   * Navigate to protein list with filters
   */
  toProteins(filters?: Record<string, any>): void {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value))
        }
      })
    }
    const queryString = params.toString()
    this.router.push(`/proteins${queryString ? `?${queryString}` : ''}`)
  }

  /**
   * Navigate to domain list with filters
   */
  toDomains(filters?: Record<string, any>): void {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value))
        }
      })
    }
    const queryString = params.toString()
    this.router.push(`/domains${queryString ? `?${queryString}` : ''}`)
  }
}

/**
 * Hook for navigation in React components
 */
import { useRouter } from 'next/navigation'

export function useNavigation() {
  const router = useRouter()
  return new NavigationHelper(router)
}

/**
 * Component helper for displaying protein links
 */
export function proteinDisplayName(protein: ProteinIdentifier): string {
  return `${protein.pdb_id}_${protein.chain_id}`
}

/**
 * Component helper for generating protein link props
 */
export function getProteinLinkProps(protein: ProteinIdentifier) {
  return {
    href: getProteinUrl(protein),
    'aria-label': `View details for protein ${proteinDisplayName(protein)}`
  }
}

/**
 * Example usage in a component:
 * 
 * import { useNavigation, getProteinUrl } from '@/lib/navigation'
 * 
 * function ProteinTable({ proteins }: { proteins: ProteinIdentifier[] }) {
 *   const nav = useNavigation()
 * 
 *   const handleProteinClick = (protein: ProteinIdentifier) => {
 *     nav.toProtein(protein)
 *   }
 * 
 *   return (
 *     <table>
 *       {proteins.map(protein => (
 *         <tr key={protein.id}>
 *           <td>
 *             <button onClick={() => handleProteinClick(protein)}>
 *               {proteinDisplayName(protein)}
 *             </button>
 *           </td>
 *         </tr>
 *       ))}
 *     </table>
 *   )
 * }
 */
