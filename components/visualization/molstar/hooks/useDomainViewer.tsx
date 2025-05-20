/**
 * useDomainViewer - Hook for visualizing protein domains in Molstar
 * 
 * This hook provides functions for highlighting and coloring protein domains,
 * which is particularly useful for ECOD domain visualization.
 */
import { useState, useCallback } from 'react';
import { useMolstar } from '../context/MolstarContext';
import { useStructureLoader } from './useStructureLoader';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';

// Types
export interface Domain {
  id: string;
  start: number;
  end: number;
  color?: string;
  label?: string;
  transparent?: boolean;
  opacity?: number;
  t_group?: string;
  h_group?: string;
  x_group?: string;
  a_group?: string;
}

interface DomainRepresentation {
  domainId: string;
  representationRef: any;
}

export interface DomainViewerResult {
  highlightDomain: (domain: Domain, chainId?: string) => Promise<boolean>;
  highlightMultipleDomains: (domains: Domain[], chainId?: string) => Promise<boolean>;
  clearDomainHighlights: () => Promise<void>;
  restoreDefaultRepresentation: () => Promise<void>;
  isHighlighting: boolean;
  error: string | null;
  activeDomains: Domain[];
}

/**
 * Hook for visualizing protein domains in Molstar
 */
export function useDomainViewer(): DomainViewerResult {
  const { plugin, addLog } = useMolstar();
  const { currentStructure, hasStructure } = useStructureLoader();

  // State
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDomains, setActiveDomains] = useState<Domain[]>([]);
  const [domainRepresentations, setDomainRepresentations] = useState<DomainRepresentation[]>([]);

  // Clear domain highlights
  const clearDomainHighlights = useCallback(async () => {
    if (!plugin || !hasStructure) return;

    try {
      setIsHighlighting(true);
      addLog('Clearing domain highlights');

      // Remove domain visual components
      for (const rep of domainRepresentations) {
        if (rep.representationRef) {
          try {
            await plugin.build().delete(rep.representationRef);
          } catch (err) {
            addLog(`Error removing domain ${rep.domainId} representation: ${err instanceof Error ? err.message : String(err)}`, 'warn');
          }
        }
      }

      setDomainRepresentations([]);
      setActiveDomains([]);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`Error clearing domain highlights: ${errorMessage}`, 'error');
      setError(errorMessage);
    } finally {
      setIsHighlighting(false);
    }
  }, [plugin, hasStructure, domainRepresentations, addLog]);

  // Restore default representation
  const restoreDefaultRepresentation = useCallback(async () => {
    if (!plugin || !hasStructure || !currentStructure) return;

    try {
      setIsHighlighting(true);
      addLog('Restoring default representation');

      // Clear domain highlights first
      await clearDomainHighlights();

      // Apply cartoon representation to everything
      await plugin.builders.structure.representation.addRepresentation(currentStructure, {
        type: 'cartoon',
        color: 'chain-id'
      });

      plugin.canvas3d?.commit();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`Error restoring default representation: ${errorMessage}`, 'error');
      setError(errorMessage);
    } finally {
      setIsHighlighting(false);
    }
  }, [plugin, hasStructure, currentStructure, clearDomainHighlights, addLog]);

  // Highlight a single domain
  const highlightDomain = useCallback(async (domain: Domain, chainId?: string): Promise<boolean> => {
    if (!plugin || !hasStructure || !currentStructure) {
      addLog('Cannot highlight domain: No structure loaded', 'warn');
      return false;
    }

    try {
      setIsHighlighting(true);
      addLog(`Highlighting domain ${domain.id} (${domain.start}-${domain.end})`);

      // Determine color based on domain properties
      let color = domain.color;
      if (!color && domain.t_group) {
        // Use T-group based color if available
        color = T_GROUP_COLORS[domain.t_group] || T_GROUP_COLORS.default;
      } else if (!color) {
        // Generate a deterministic color based on domain ID if no classification
        const hash = domain.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hue = hash % 360;
        color = `hsl(${hue}, 70%, 50%)`;
      }

      // Create selection query for the domain residues
      const query = {
        residueTest: (residue: any) => {
          const seqNumber = residue.seqNumber.value;
          return seqNumber >= domain.start && seqNumber <= domain.end;
        }
      };

      // If chain is specified, add it to the query
      if (chainId) {
        Object.assign(query, {
          chainTest: (chain: any) => {
            return chain.authAsymId === chainId;
          }
        });
      }

      // Add cartoon representation for the domain
      const representation = await plugin.builders.structure.representation.addRepresentation(currentStructure, {
        type: 'cartoon',
        color: 'uniform',
        colorParams: { value: { r: hexToRgb(color).r, g: hexToRgb(color).g, b: hexToRgb(color).b } },
        size: 'uniform',
        sizeParams: { value: 0.6 },
        alpha: domain.transparent ? (domain.opacity || 0.7) : 1.0
      }, { selector: plugin.helpers.structureSelectionBuilder.withPredicate(currentStructure!, query) });

      // Store the representation for later removal
      setDomainRepresentations(prev => [...prev, { domainId: domain.id, representationRef: representation }]);
      setActiveDomains(prev => [...prev, domain]);

      // Focus camera on the domain
      const loci = plugin.helpers.structureSelectionBuilder.buildFromPredicate(currentStructure!,
        (structure: any) => query
      );

      if (loci.elements.length > 0) {
        plugin.managers.camera.focusLoci(loci);
        plugin.canvas3d?.commit();
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`Error highlighting domain: ${errorMessage}`, 'error');
      setError(errorMessage);
      return false;
    } finally {
      setIsHighlighting(false);
    }
  }, [plugin, hasStructure, currentStructure, addLog]);

  // Highlight multiple domains at once
  const highlightMultipleDomains = useCallback(async (domains: Domain[], chainId?: string): Promise<boolean> => {
    if (!plugin || !hasStructure || !currentStructure) {
      addLog('Cannot highlight domains: No structure loaded', 'warn');
      return false;
    }

    try {
      setIsHighlighting(true);
      addLog(`Highlighting ${domains.length} domains`);

      // First clear any existing domain highlights
      await clearDomainHighlights();

      // Highlight each domain
      let success = true;
      for (const domain of domains) {
        const result = await highlightDomain(domain, chainId);
        if (!result) success = false;
      }

      // Focus on the structure after highlighting all domains
      plugin.canvas3d?.resetCamera();
      plugin.canvas3d?.commit();

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`Error highlighting multiple domains: ${errorMessage}`, 'error');
      setError(errorMessage);
      return false;
    } finally {
      setIsHighlighting(false);
    }
  }, [plugin, hasStructure, currentStructure, highlightDomain, clearDomainHighlights, addLog]);

  return {
    highlightDomain,
    highlightMultipleDomains,
    clearDomainHighlights,
    restoreDefaultRepresentation,
    isHighlighting,
    error,
    activeDomains
  };
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number, g: number, b: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle shorthand hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return { r, g, b };
}

// T-Group to color mapping for consistent coloring of domains by classification
export const T_GROUP_COLORS: Record<string, string> = {
  // Alpha proteins
  '1.10.8': '#FF5733', // Alpha-horseshoe
  '1.20.5': '#FFC300', // Alpha-solenoid
  '1.10.10': '#DAF7A6', // Orthogonal Bundle
  '1.20.120': '#C70039', // Up-down Bundle

  // Beta proteins
  '2.40.50': '#900C3F', // Beta-barrel
  '2.60.40': '#581845', // Beta-sandwich
  '2.30.30': '#2471A3', // Beta-trefoil

  // Alpha/Beta proteins
  '3.40.50': '#1ABC9C', // Rossmann fold
  '3.30.70': '#2E86C1', // TIM barrel
  '3.90.1580': '#8E44AD', // ATP-binding domain

  // Other groups
  '4.10.220': '#7D3C98', // Immunoglobulin-like
  '4.10.520': '#138D75', // SH3-like

  // Default colors for other groups
  'default': '#3498DB' // Default blue
};
