/**
 * useStructureLoader - Hook for loading molecular structures in Molstar
 * 
 * This hook provides a clean API for loading structures and handling the loading
 * process state (loading, error, success).
 */
import { useState, useCallback, useEffect } from 'react';
import { useMolstar } from '../context/MolstarContext';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { StateObjectSelector } from 'molstar/lib/mol-state';
import {
  getValidFormatName,
  detectFormatFromContent,
  detectFormatFromContentType
} from '../index';

// Types
export interface StructureInfo {
  pdbId: string;
  chainId?: string;
  entityId?: string;
  format?: 'mmcif' | 'pdb' | 'mmtf' | 'auto';
  representationStyle?: 'cartoon' | 'ball-and-stick' | 'surface' | 'ribbon' | 'spacefill';
  assemblyId?: string;
  useLocalRepository?: boolean;
}

export interface StructureLoaderResult {
  loadStructure: (info: StructureInfo) => Promise<boolean>;
  clearStructure: () => Promise<void>;
  focusStructure: () => Promise<void>;
  focusChain: (chainId: string) => Promise<boolean>;
  isLoading: boolean;
  hasStructure: boolean;
  structureInfo: StructureInfo | null;
  error: string | null;
  currentStructure: StateObjectSelector<PluginStateObject.Molecule.Structure, any> | null;
}

/**
 * Hook to load and manipulate molecular structures in Molstar
 */
export function useStructureLoader(): StructureLoaderResult {
  const { plugin, isBusy, addLog } = useMolstar();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [hasStructure, setHasStructure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [structureInfo, setStructureInfo] = useState<StructureInfo | null>(null);
  const [currentStructure, setCurrentStructure] = useState<StateObjectSelector<PluginStateObject.Molecule.Structure, any> | null>(null);

  // Clear structure
  const clearStructure = useCallback(async () => {
    if (!plugin) return;

    try {
      addLog('Clearing structure...');
      await plugin.clear();
      setHasStructure(false);
      setCurrentStructure(null);
      setStructureInfo(null);
      addLog('Structure cleared');
    } catch (err) {
      addLog(`Error clearing structure: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [plugin, addLog]);

  // Focus on loaded structure
  const focusStructure = useCallback(async () => {
    if (!plugin || !hasStructure) return;

    try {
      addLog('Focusing on structure');
      plugin.canvas3d?.resetCamera();
      plugin.canvas3d?.commit();
    } catch (err) {
      addLog(`Error focusing on structure: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [plugin, hasStructure, addLog]);

  // Focus on a specific chain
  const focusChain = useCallback(async (chainId: string) => {
    if (!plugin || !hasStructure) return false;

    try {
      addLog(`Focusing on chain ${chainId}`);

      // Create selection query
      const selection = {
        query: {
          'chain-id': { '==': chainId.toUpperCase() }
        },
        descriptions: [{ text: `Chain ${chainId}` }],
      };

      // Select and focus
      const sel = plugin.managers.structure.selection.fromSelectionQuery(selection);
      if (!sel.structures.length) {
        addLog(`Chain ${chainId} not found in structure`, 'warn');
        return false;
      }

      // Focus camera on selection
      plugin.managers.camera.focusLoci(sel);
      plugin.canvas3d?.commit();

      return true;
    } catch (err) {
      addLog(`Error focusing on chain ${chainId}: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    }
  }, [plugin, hasStructure, addLog]);

  // Determine API URL based on the structure info
  const getStructureUrl = useCallback((info: StructureInfo): string => {
    const { pdbId, format, useLocalRepository = true } = info;

    if (useLocalRepository) {
      // Use local repository API
      return `/api/pdb/${pdbId.toLowerCase()}`;
    } else {
      // Use RCSB PDB API
      const fileExtension = format === 'pdb' ? 'pdb' :
                           format === 'mmtf' ? 'mmtf' : 'cif';
      return `https://files.rcsb.org/download/${pdbId.toLowerCase()}.${fileExtension}`;
    }
  }, []);

  // Apply structure representation
  const applyRepresentation = useCallback(async (
    trajectory: any,
    style: string = 'cartoon',
    assemblyId?: string
  ) => {
    if (!plugin) return null;

    try {
      // Determine structure preset based on style
      const preset: keyof StructureRepresentationPresetProvider =
        style === 'ball-and-stick' ? 'ball-and-stick' :
        style === 'surface' ? 'surface' :
        style === 'ribbon' ? 'ribbon' :
        style === 'spacefill' ? 'spacefill' : 'cartoon';

      // Determine assembly or model
      const structurePreset = assemblyId
        ? { name: 'assembly', params: { id: assemblyId }}
        : { name: 'model', params: {} };
      
      // Apply preset to the structure
      const builder = plugin.builders.structure;
      const hierarchy = await builder.hierarchy.applyPreset(trajectory, {
        id: `preset-structure-representation-${preset}`,
        params: {
          structure: structurePreset
        }
      });
      
      return hierarchy.structures?.[0] || null;
    } catch (err) {
      addLog(`Error applying representation: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return null;
    }
  }, [plugin, addLog]);
  
  // Load structure
  const loadStructure = useCallback(async (info: StructureInfo): Promise<boolean> => {
    if (!plugin) {
      addLog('Cannot load structure: Molstar not initialized', 'error');
      return false;
    }
    
    try {
      // Set loading state
      setIsLoading(true);
      setError(null);
      setStructureInfo(info);
      
      const { pdbId, chainId, format = 'auto', representationStyle = 'cartoon', assemblyId } = info;
      addLog(`Loading structure: ${pdbId}${chainId ? ` (chain ${chainId})` : ''}${assemblyId ? ` (assembly ${assemblyId})` : ''}`);
      
      // Clear existing structure
      await plugin.clear();
      
      // Construct URL
      const url = getStructureUrl(info);
      addLog(`Fetching from: ${url}`);
      
      // Fetch data using data transaction for proper cancellation and cleanup
      return await plugin.dataTransaction(async () => {
        try {
          // Determine format
          let formatName = format === 'auto' ? 'mmcif' : getValidFormatName(format);
          
          // Try to detect format from headers for auto mode
          if (format === 'auto') {
            try {
              const headResponse = await fetch(url, { method: 'HEAD' });
              if (headResponse.ok) {
                // Check header for format
                const formatHeader = headResponse.headers.get('X-PDB-Format');
                const contentType = headResponse.headers.get('Content-Type');
                
                if (formatHeader) {
                  formatName = getValidFormatName(formatHeader);
                  addLog(`Format detected from header: ${formatName}`);
                } else if (contentType) {
                  const detectedFormat = detectFormatFromContentType(contentType);
                  if (detectedFormat) {
                    formatName = detectedFormat;
                    addLog(`Format detected from content type: ${formatName}`);
                  }
                }
              }
            } catch (headerError) {
              addLog(`Header request failed, using default format: ${formatName}`, 'warn');
            }
          }
          
          // Fetch data
          addLog(`Downloading structure data...`);
          const data = await plugin.builders.data.download({ url, isBinary: formatName === 'mmtf' });
          
          if (!data.data) {
            throw new Error('Downloaded data is empty');
          }
          
          // Try to detect format from content if in auto mode
          if (format === 'auto' && data.data) {
            try {
              // Convert buffer to string for first few bytes to check format signatures
              const bytes = data.data;
              if (bytes instanceof Uint8Array) {
                const firstBytes = new TextDecoder().decode(bytes.slice(0, 200));
                const contentFormat = detectFormatFromContent(firstBytes);
                if (contentFormat) {
                  formatName = contentFormat;
                  addLog(`Format detected from content: ${formatName}`);
                }
              }
            } catch (contentDetectionError) {
              addLog(`Format detection from content failed: ${contentDetectionError instanceof Error ? contentDetectionError.message : String(contentDetectionError)}`, 'warn');
            }
          }
          
          // Log data size and try to parse
          addLog(`Downloaded ${data.data?.byteLength || 'unknown'} bytes of data`);
          
          let trajectory;
          try {
            // Try primary format
            addLog(`Parsing structure as ${formatName}`);
            trajectory = await plugin.builders.structure.parseTrajectory(data, formatName);
          } catch (primaryError) {
            // If primary format fails, try alternatives
            addLog(`Error parsing as ${formatName}: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`, 'warn');
            
            // Try alternative formats
            const alternatives = ['mmcif', 'pdb', 'mmtf'].filter(f => f !== formatName);
            
            for (const alt of alternatives) {
              try {
                addLog(`Trying alternative format: ${alt}`);
                trajectory = await plugin.builders.structure.parseTrajectory(data, alt);
                formatName = alt;
                addLog(`Successfully parsed as ${alt}`);
                break;
              } catch (altError) {
                addLog(`Alternative format ${alt} also failed`, 'warn');
              }
            }
            
            if (!trajectory) {
              throw new Error(`Failed to parse structure in any supported format`);
            }
          }
          
          // Apply representation 
          addLog(`Applying ${representationStyle} representation`);
          const structure = await applyRepresentation(trajectory, representationStyle, assemblyId);
          
          if (!structure) {
            throw new Error('Failed to apply structure representation');
          }
          
          // Update state
          setCurrentStructure(structure);
          setHasStructure(true);
          
          // Focus on the structure or specific chain
          if (chainId) {
            addLog(`Focusing on chain ${chainId}`);
            setTimeout(() => focusChain(chainId), 100);
          } else {
            addLog('Focusing on complete structure');
            plugin.canvas3d?.resetCamera();
          }
          
          addLog('Structure loaded successfully');
          return true;
        } catch (transactionError) {
          const errorMessage = transactionError instanceof Error ? 
            transactionError.message : String(transactionError);
          
          addLog(`Error loading structure: ${errorMessage}`, 'error');
          setError(errorMessage);
          return false;
        } finally {
          setIsLoading(false);
        }
      });
    } catch (outerError) {
      const errorMessage = outerError instanceof Error ? 
        outerError.message : String(outerError);
      
      addLog(`Fatal error loading structure: ${errorMessage}`, 'error');
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  }, [plugin, getStructureUrl, applyRepresentation, focusChain, addLog]);
  
  // Return the API
  return {
    loadStructure,
    clearStructure,
    focusStructure,
    focusChain,
    isLoading: isLoading || isBusy,
    hasStructure,
    structureInfo,
    error,
    currentStructure
  };
}
